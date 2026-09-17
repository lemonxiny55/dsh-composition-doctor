import { lstat, readFile, readdir } from 'node:fs/promises'
import { delimiter, join, resolve } from 'node:path'
import { stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { downloadNpmArtifact, fileDigest, readNpmCacheMetadata, tarManifest } from './npm-artifact.js'

const execFileAsync = promisify(execFile)

export interface ArtifactResolutionOptions { targetDsh: string; dshBin?: string; dshPackage?: string; online: boolean; cacheDir?: string; packageManagerCacheDirs?: readonly string[] }
export type ArtifactKind = 'dsh-bin' | 'dsh-package' | 'dsh-tarball' | 'unavailable'
export type ArtifactSource = 'explicit-local' | 'installed' | 'package-manager-cache' | 'doctor-cache' | 'npm-registry' | 'unavailable'
export interface ArtifactResolution { kind: ArtifactKind; path?: string; detail: string; targetVersionVerified: boolean; source: ArtifactSource; requestedVersion: string; resolvedVersion?: string; manifest?: Record<string, unknown>; sha512?: string; integrity?: string }

async function readableFile(path: string): Promise<boolean> {
  try { return (await stat(path)).isFile() } catch { return false }
}

async function readableDirectory(path: string): Promise<boolean> {
  try { return (await stat(path)).isDirectory() } catch { return false }
}

async function respondsToVersion(path: string): Promise<boolean> {
  try {
    const shim = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(path)
    const executable = shim ? (process.env.ComSpec ?? 'cmd.exe') : path
    const args = shim ? ['/d', '/s', '/c', `call "${path}" --version`] : ['--version']
    await execFileAsync(executable, args, { windowsHide: true, timeout: 5_000, maxBuffer: 128 * 1024 })
    return true
  } catch {
    return false
  }
}

async function explicitPackage(path: string, targetDsh: string): Promise<ArtifactResolution> {
  if (await readableFile(path)) {
    if (/\.(?:tgz|tar|tar\.gz)$/i.test(path)) {
      try {
        const bytes = await readFile(path)
        const manifest = tarManifest(bytes)
        const digest = await fileDigest(path)
        const resolvedVersion = typeof manifest.version === 'string' ? manifest.version : undefined
        return { kind: 'dsh-tarball', path, detail: resolvedVersion === targetDsh ? `Using explicit local DSH ${targetDsh} tarball.` : `Using local DSH tarball candidate ${resolvedVersion ?? 'unknown'}; target ${targetDsh} is not verified.`, targetVersionVerified: resolvedVersion === targetDsh, source: 'explicit-local', requestedVersion: targetDsh, resolvedVersion, manifest, ...digest }
      } catch {
        return { kind: 'unavailable', detail: `Explicit DSH tarball could not be inspected: ${path}`, targetVersionVerified: false, source: 'unavailable', requestedVersion: targetDsh }
      }
    }
    return { kind: 'unavailable', detail: `Explicit DSH package path is a file but not a supported local tarball: ${path}`, targetVersionVerified: false, source: 'unavailable', requestedVersion: targetDsh }
  }
  if (!(await readableDirectory(path))) return { kind: 'unavailable', detail: `Explicit DSH package path is not readable: ${path}`, targetVersionVerified: false, source: 'unavailable', requestedVersion: targetDsh }
  try {
    const manifest = JSON.parse(await readFile(join(path, 'package.json'), 'utf8')) as { version?: unknown; bin?: unknown }
    const version = typeof manifest.version === 'string' ? manifest.version : undefined
    const hasBin = typeof manifest.bin === 'string' || (manifest.bin !== null && typeof manifest.bin === 'object')
    const digest = await fileDigest(join(path, 'package.json'))
    if (!hasBin) return { kind: 'unavailable', detail: `Local DSH package has no public bin entry: ${path}`, targetVersionVerified: false, source: 'unavailable', requestedVersion: targetDsh, resolvedVersion: version, manifest, ...digest }
    return { kind: 'dsh-package', path, detail: version === targetDsh ? `Using local DSH package ${targetDsh}.` : `Using local DSH package candidate ${version ?? 'unknown'}; target ${targetDsh} is not verified.`, targetVersionVerified: version === targetDsh, source: 'explicit-local', requestedVersion: targetDsh, resolvedVersion: version, manifest, ...digest }
  } catch {
    return { kind: 'unavailable', detail: `Local DSH package has no readable package.json: ${path}`, targetVersionVerified: false, source: 'unavailable', requestedVersion: targetDsh }
  }
}

async function cachedTarball(targetDsh: string, cacheDir: string, source: 'package-manager-cache' | 'doctor-cache'): Promise<ArtifactResolution | undefined> {
  try {
    const names = await readdir(cacheDir)
    const path = names.map((name) => resolve(cacheDir, name)).find((candidate) => candidate.endsWith('.tgz') && candidate.includes(targetDsh))
    if (path === undefined) return undefined
    if (!(await lstat(path)).isFile()) return undefined
    const bytes = await readFile(path)
    const manifest = tarManifest(bytes)
    const resolvedVersion = typeof manifest.version === 'string' ? manifest.version : undefined
    const digest = await fileDigest(path)
    if (source === 'doctor-cache') {
      const metadata = await readNpmCacheMetadata(path)
      if (metadata === undefined || metadata.resolvedVersion !== resolvedVersion || metadata.sha512 !== digest.sha512 || metadata.integrity !== digest.integrity) return undefined
    }
    const label = source === 'doctor-cache' ? 'Doctor cache' : 'package-manager cache/store'
    return { kind: 'dsh-tarball', path, detail: resolvedVersion === targetDsh ? `Using ${label} artifact for DSH ${targetDsh}.` : `${label} contains DSH ${resolvedVersion ?? 'unknown'}, not requested ${targetDsh}.`, targetVersionVerified: resolvedVersion === targetDsh, source, requestedVersion: targetDsh, resolvedVersion, manifest, ...digest }
  } catch {
    return undefined
  }
}

async function installedDsh(): Promise<{ path: string; version?: string } | undefined> {
  const pathValue = process.env.PATH ?? ''
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    const candidates = process.platform === 'win32' ? [join(directory, 'dsh.cmd'), join(directory, 'dsh.exe'), join(directory, 'dsh')] : [join(directory, 'dsh')]
    for (const candidate of candidates) if (await readableFile(candidate) && await respondsToVersion(candidate)) {
      try {
        const shim = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(candidate)
        const executable = shim ? (process.env.ComSpec ?? 'cmd.exe') : candidate
        const args = shim ? ['/d', '/s', '/c', `call "${candidate}" --version`] : ['--version']
        const result = await execFileAsync(executable, args, { windowsHide: true, timeout: 5_000, maxBuffer: 128 * 1024 }) as unknown as { stdout: string; stderr: string }
        return { path: candidate, version: `${result.stdout}\n${result.stderr}`.trim() }
      } catch { return { path: candidate } }
    }
  }
  return undefined
}

/** Offline-first target artifact discovery. No registry, Git, cache install, or lifecycle is performed. */
export async function resolveDshArtifact(options: ArtifactResolutionOptions): Promise<ArtifactResolution> {
  if (options.dshBin !== undefined) {
    if (await readableFile(options.dshBin)) return { kind: 'dsh-bin', path: options.dshBin, detail: `Using explicit local DSH binary candidate for ${options.targetDsh}; release version is not verified until --version is checked.`, targetVersionVerified: false, source: 'explicit-local', requestedVersion: options.targetDsh, ...(await fileDigest(options.dshBin)) }
    return { kind: 'unavailable', detail: `Explicit DSH binary path is not readable: ${options.dshBin}`, targetVersionVerified: false, source: 'unavailable', requestedVersion: options.targetDsh }
  }
  if (options.dshPackage !== undefined) return explicitPackage(options.dshPackage, options.targetDsh)

  const installed = await installedDsh()
  if (installed !== undefined) return { kind: 'dsh-bin', path: installed.path, detail: `Using installed local dsh candidate for ${options.targetDsh}; release version is not verified.`, targetVersionVerified: installed.version?.includes(options.targetDsh) === true, source: 'installed', requestedVersion: options.targetDsh, resolvedVersion: installed.version, ...(await fileDigest(installed.path)) }

  for (const directory of options.packageManagerCacheDirs ?? []) {
    const cached = await cachedTarball(options.targetDsh, directory, 'package-manager-cache')
    if (cached !== undefined && cached.targetVersionVerified) return cached
  }

  if (options.cacheDir !== undefined) {
    const cached = await cachedTarball(options.targetDsh, options.cacheDir, 'doctor-cache')
    if (cached !== undefined && cached.targetVersionVerified) return cached
  }

  if (options.online) {
    try {
      const downloaded = await downloadNpmArtifact(`@deepseek-ai/dsh@${options.targetDsh}`, options.cacheDir ?? join(tmpdir(), 'dsh-composition-doctor-cache'))
      return { kind: 'dsh-tarball', path: downloaded.path, detail: `Downloaded official DSH ${downloaded.resolvedVersion} artifact from npm registry into Doctor-owned cache.`, targetVersionVerified: downloaded.resolvedVersion === options.targetDsh, source: downloaded.source, requestedVersion: options.targetDsh, resolvedVersion: downloaded.resolvedVersion, manifest: downloaded.manifest, sha512: downloaded.sha512, integrity: downloaded.integrity }
    } catch (error: unknown) {
      return { kind: 'unavailable', detail: `Official npm artifact download failed for DSH ${options.targetDsh}: ${error instanceof Error ? error.message : String(error)}`, targetVersionVerified: false, source: 'unavailable', requestedVersion: options.targetDsh }
    }
  }

  return {
    kind: 'unavailable',
    detail: `Target DSH ${options.targetDsh} artifact unavailable offline; no permitted local package-manager cache/store or Doctor cache contained the exact release.`,
    targetVersionVerified: false,
    source: 'unavailable',
    requestedVersion: options.targetDsh
  }
}
