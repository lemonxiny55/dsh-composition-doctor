import { createHash, randomBytes } from 'node:crypto'
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'

export interface NpmArtifact {
  path: string
  requestedSpec: string
  resolvedVersion: string
  manifest: Record<string, unknown>
  source: 'npm-registry'
  registry: 'https://registry.npmjs.org'
  sha512: string
  integrity: string
}

function text(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes).replace(/\0+$/g, '')
}

export function tarManifest(bytes: Uint8Array): Record<string, unknown> {
  // npm publishes gzip-compressed tar archives (.tgz). Keep accepting a
  // plain tar too because explicit local fixtures are useful in unit tests.
  const archive = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes
  let manifest: Record<string, unknown> | undefined
  for (let offset = 0; offset + 512 <= archive.length;) {
    const name = text(archive.slice(offset, offset + 100))
    if (name.length === 0) break
    const normalizedName = name.replaceAll('\\', '/')
    const pathParts = normalizedName.split('/')
    const type = archive[offset + 156]
    if (normalizedName.startsWith('/') || /^[A-Za-z]:\//.test(normalizedName) || name.includes('\\') || pathParts.includes('..')) {
      throw new Error(`npm tarball contains an unsafe path: ${name}`)
    }
    if (type === 49 || type === 50) throw new Error(`npm tarball contains a link entry: ${name}`)
    const sizeText = text(archive.slice(offset + 124, offset + 136)).trim()
    const size = Number.parseInt(sizeText || '0', 8)
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`npm tarball contains an invalid entry size: ${name}`)
    const dataStart = offset + 512
    if (dataStart + size > archive.length) throw new Error(`npm tarball entry is truncated: ${name}`)
    if (normalizedName === 'package/package.json') manifest = JSON.parse(text(archive.slice(dataStart, dataStart + size))) as Record<string, unknown>
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  if (manifest === undefined) throw new Error('npm tarball has no package/package.json')
  return manifest
}

function digest(bytes: Uint8Array): { sha512: string; integrity: string } {
  const hash = createHash('sha512').update(bytes)
  const base64 = hash.digest('base64')
  const sha512 = createHash('sha512').update(bytes).digest('hex')
  return { sha512, integrity: `sha512-${base64}` }
}

function exactPackageSpec(requestedSpec: string): { name: string; version: string } {
  const separator = requestedSpec.lastIndexOf('@')
  if (separator <= 0 || separator === requestedSpec.length - 1) throw new Error(`Only exact npm package specs are supported: ${requestedSpec}`)
  return { name: requestedSpec.slice(0, separator), version: requestedSpec.slice(separator + 1) }
}

interface RegistryVersionMetadata {
  version?: unknown
  dist?: { tarball?: unknown; integrity?: unknown; shasum?: unknown }
  [key: string]: unknown
}

export interface NpmCacheMetadata {
  requestedSpec: string
  resolvedVersion: string
  registry: 'https://registry.npmjs.org'
  sha512: string
  integrity: string
}

function metadataPath(path: string): string {
  return `${path}.metadata.json`
}

async function atomicWrite(path: string, bytes: Uint8Array): Promise<void> {
  const temporaryPath = `${path}.${randomBytes(12).toString('hex')}.partial`
  try {
    await writeFile(temporaryPath, bytes, { flag: 'wx' })
    await rename(temporaryPath, path)
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
  }
}

export async function readNpmCacheMetadata(path: string): Promise<NpmCacheMetadata | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(metadataPath(path), 'utf8'))
    if (value === null || typeof value !== 'object') return undefined
    const metadata = value as Partial<NpmCacheMetadata>
    if (typeof metadata.requestedSpec !== 'string' || typeof metadata.resolvedVersion !== 'string' || metadata.registry !== 'https://registry.npmjs.org' || typeof metadata.sha512 !== 'string' || typeof metadata.integrity !== 'string') return undefined
    return metadata as NpmCacheMetadata
  } catch {
    return undefined
  }
}

async function registryJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status} for ${url}`)
  const value: unknown = await response.json()
  if (value === null || typeof value !== 'object') throw new Error(`npm registry returned invalid JSON for ${url}`)
  return value as Record<string, unknown>
}

/** Downloads one exact npm package tarball into Doctor-owned cache storage without install or lifecycle execution. */
export async function downloadNpmArtifact(requestedSpec: string, cacheDir: string): Promise<NpmArtifact> {
  const directory = resolve(cacheDir)
  await mkdir(directory, { recursive: true })
  const { name, version } = exactPackageSpec(requestedSpec)
  const metadataUrl = `https://registry.npmjs.org/${encodeURIComponent(name)}`
  const packageMetadata = await registryJson(metadataUrl)
  const versions = packageMetadata.versions
  const versionMetadata = versions !== null && typeof versions === 'object'
    ? (versions as Record<string, unknown>)[version]
    : undefined
  if (versionMetadata === null || typeof versionMetadata !== 'object') throw new Error(`npm registry has no exact version ${version} for ${name}`)
  const metadata = versionMetadata as RegistryVersionMetadata
  const dist = metadata.dist
  if (dist === undefined) throw new Error(`npm registry metadata has no dist information for ${requestedSpec}`)
  const tarballUrl = dist?.tarball
  if (typeof tarballUrl !== 'string') throw new Error(`npm registry metadata has no tarball URL for ${requestedSpec}`)
  const response = await fetch(tarballUrl, { headers: { accept: 'application/octet-stream' } })
  if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status} for ${tarballUrl}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const filename = basename(new URL(tarballUrl).pathname) || `${name.replaceAll('/', '-')}-${version}.tgz`
  const path = resolve(directory, filename)
  const manifest = tarManifest(bytes)
  const resolvedVersion = typeof manifest.version === 'string' ? manifest.version : undefined
  if (resolvedVersion === undefined) throw new Error(`npm tarball has no resolved version for ${requestedSpec}`)
  if (manifest.name !== name || resolvedVersion !== version) throw new Error(`npm tarball manifest does not match exact request ${requestedSpec}`)
  const computed = digest(bytes)
  if (typeof dist.integrity === 'string' && dist.integrity !== computed.integrity) throw new Error(`npm registry integrity mismatch for ${requestedSpec}`)
  const integrity = typeof dist.integrity === 'string' ? dist.integrity : computed.integrity
  const cacheMetadata: NpmCacheMetadata = { requestedSpec, resolvedVersion, registry: 'https://registry.npmjs.org', sha512: computed.sha512, integrity }
  await atomicWrite(metadataPath(path), Buffer.from(`${JSON.stringify(cacheMetadata)}\n`, 'utf8'))
  await atomicWrite(path, bytes)
  return { path, requestedSpec, resolvedVersion, manifest, source: 'npm-registry', registry: 'https://registry.npmjs.org', ...computed, integrity }
}

export async function fileDigest(path: string): Promise<{ sha512: string; integrity: string }> {
  const bytes = await readFile(path)
  return digest(bytes)
}
