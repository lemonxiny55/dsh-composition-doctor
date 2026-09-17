import { createRequire } from 'node:module'
import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import type { InstalledPackageFact } from './types.js'

interface PackageManifest {
  name?: unknown
  version?: unknown
  dsh?: unknown
  repository?: unknown
  gitHead?: unknown
  dist?: unknown
  os?: unknown
  peerDependencies?: unknown
  engines?: unknown
  scripts?: unknown
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function repositoryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  const object = record(value)
  return object === undefined ? undefined : string(object.url)
}

function gitRefFrom(repository: string | undefined, manifest: PackageManifest): string | undefined {
  const explicit = string(manifest.gitHead)
  if (explicit !== undefined) return explicit
  const match = repository?.match(/#([0-9a-f]{7,40})$/i)
  return match?.[1]
}

function packageJsonPath(profileDir: string, name: string): string {
  if (!/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name)) throw new Error(`Invalid bundle package name: ${name}`)
  const require = createRequire(resolve(profileDir, 'package.json'))
  return require.resolve(`${name}/package.json`)
}

function within(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate)
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

export async function inspectInstalledPackage(profileDir: string, name: string, requestedSpec?: string): Promise<InstalledPackageFact> {
  const profileRoot = await realpath(profileDir)
  const source = packageJsonPath(profileDir, name)
  const resolvedSource = await realpath(source)
  if (!within(profileRoot, resolvedSource)) throw new Error(`Bundle package resolves outside the selected profile: ${name}`)
  const manifest = JSON.parse(await readFile(resolvedSource, 'utf8')) as PackageManifest
  const dsh = record(manifest.dsh)
  const bundle = record(dsh?.bundle)
  const dist = record(manifest.dist)
  const peers = record(manifest.peerDependencies)
  const engines = record(manifest.engines)
  const scripts = record(manifest.scripts)
  const peerDsh = string(peers?.['@deepseek-ai/dsh'])
  const peerCordis = string(peers?.['@deepseek-ai/cordis']) ?? string(peers?.cordis) ?? string(peers?.['@cordisjs/core'])
  const engineNode = string(engines?.node)
  const repository = repositoryValue(manifest.repository)
  const fileStat = await stat(source)
  const declaredPatch = string(bundle?.patch)
  const patchPath = declaredPatch === undefined ? undefined : resolve(dirname(resolvedSource), declaredPatch)
  if (patchPath !== undefined && !within(profileRoot, patchPath)) throw new Error(`Bundle patch resolves outside the selected profile: ${name}`)
  const safePatch = patchPath === undefined ? undefined : await realpath(patchPath).then((resolvedPatch) => {
    if (!within(profileRoot, resolvedPatch)) throw new Error(`Bundle patch resolves outside the selected profile: ${name}`)
    return resolvedPatch
  }).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return patchPath
    throw error
  })
  return {
    name,
    ...(requestedSpec === undefined ? {} : { requestedSpec }),
    ...(string(manifest.version) === undefined ? {} : { installedVersion: string(manifest.version) }),
    packageJsonSource: source,
    ...(safePatch === undefined ? {} : { bundlePatch: safePatch }),
    ...(repository === undefined ? {} : { repository }),
    ...(gitRefFrom(repository, manifest) === undefined ? {} : { gitRef: gitRefFrom(repository, manifest) }),
    ...(string(dist?.integrity) === undefined ? {} : { integrity: string(dist?.integrity) }),
    modifiedAt: fileStat.mtime.toISOString(),
    ...(Array.isArray(manifest.os) ? { platform: manifest.os.filter((item): item is string => typeof item === 'string') } : {}),
    ...(peerDsh === undefined ? {} : { peerDsh }),
    ...(peerCordis === undefined ? {} : { peerCordis }),
    ...(engineNode === undefined ? {} : { engineNode }),
    ...(scripts === undefined ? {} : { lifecycleScripts: ['preinstall', 'install', 'postinstall', 'prepare'].filter((key) => typeof scripts[key] === 'string') })
  }
}
