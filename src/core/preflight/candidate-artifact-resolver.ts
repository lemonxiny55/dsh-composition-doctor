import { lstat, readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { downloadNpmArtifact, fileDigest, tarManifest } from './npm-artifact.js'

export interface CandidateArtifact {
  name: string
  requestedVersion: string
  installedVersion: string
  packageJsonPath: string
  lifecycleScripts: readonly string[]
  source: 'profile-node_modules' | 'package-manager-cache' | 'npm-registry'
  manifest: Record<string, unknown>
  integrity?: string
  sha512?: string
  registry?: string
}

export interface CandidateResolution {
  status: 'resolved' | 'unavailable'
  candidate: string
  artifact?: CandidateArtifact
  detail: string
}

function candidateParts(candidate: string): { name: string; version: string } {
  const at = candidate.lastIndexOf('@')
  return { name: candidate.slice(0, at), version: candidate.slice(at + 1) }
}

function packagePath(profileDir: string, name: string): string {
  return resolve(profileDir, 'node_modules', ...name.split('/'), 'package.json')
}

/** Reads only an already-installed candidate manifest; it never invokes a package manager. */
export async function resolveCandidateArtifact(profileDir: string, candidate: string, online: boolean, cacheDir?: string, packageManagerCacheDirs?: readonly string[]): Promise<CandidateResolution> {
  const { name, version } = candidateParts(candidate)
  const packageJsonPath = packagePath(profileDir, name)
  try {
    const manifest = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { version?: unknown; scripts?: Record<string, unknown> }
    const installedVersion = typeof manifest.version === 'string' ? manifest.version : 'unknown'
    if (installedVersion !== version) return { status: 'unavailable', candidate, detail: `Local candidate manifest version ${installedVersion} does not match requested ${version}.` }
    const scripts = manifest.scripts ?? {}
    const lifecycleScripts = ['preinstall', 'install', 'postinstall', 'prepare'].filter((key) => typeof scripts[key] === 'string')
    return { status: 'resolved', candidate, detail: 'Inspected an existing local candidate manifest; no install or lifecycle was executed.', artifact: { name, requestedVersion: version, installedVersion, packageJsonPath, lifecycleScripts, source: 'profile-node_modules', manifest } }
  } catch {
    for (const directory of packageManagerCacheDirs ?? []) {
      try {
        const nameInFilename = name.replaceAll('/', '-')
        const filename = (await readdir(directory)).find((entry) => entry.endsWith('.tgz') && entry.includes(nameInFilename) && entry.includes(version))
        if (filename === undefined) continue
        const tarballPath = resolve(directory, filename)
        if (!(await lstat(tarballPath)).isFile()) continue
        const manifest = tarManifest(await readFile(tarballPath))
        if (manifest.name !== name || manifest.version !== version) continue
        const scripts = manifest.scripts !== null && typeof manifest.scripts === 'object' ? manifest.scripts as Record<string, unknown> : {}
        const lifecycleScripts = ['preinstall', 'install', 'postinstall', 'prepare'].filter((key) => typeof scripts[key] === 'string')
        const digest = await fileDigest(tarballPath)
        return { status: 'resolved', candidate, detail: 'Inspected an exact package-manager cache/store tarball; no install or lifecycle was executed.', artifact: { name, requestedVersion: version, installedVersion: version, packageJsonPath: tarballPath, lifecycleScripts, source: 'package-manager-cache', manifest, integrity: digest.integrity, sha512: digest.sha512 } }
      } catch {
        // An unreadable cache entry is not evidence of an unavailable release.
      }
    }
    if (!online) return { status: 'unavailable', candidate, detail: `${candidate} is not available as an exact local profile node_modules artifact offline.` }
    try {
      const downloaded = await downloadNpmArtifact(candidate, cacheDir ?? resolve(tmpdir(), 'dsh-composition-doctor-cache'))
      if (downloaded.resolvedVersion !== version) return { status: 'unavailable', candidate, detail: `npm resolved ${downloaded.resolvedVersion}, not requested ${version}; the downloaded artifact was not accepted.` }
      const scripts = downloaded.manifest.scripts !== null && typeof downloaded.manifest.scripts === 'object' ? downloaded.manifest.scripts as Record<string, unknown> : {}
      const lifecycleScripts = ['preinstall', 'install', 'postinstall', 'prepare'].filter((key) => typeof scripts[key] === 'string')
      return { status: 'resolved', candidate, detail: `Downloaded and inspected the exact npm artifact into Doctor-owned cache; no install or lifecycle was executed.`, artifact: { name, requestedVersion: version, installedVersion: downloaded.resolvedVersion, packageJsonPath: downloaded.path, lifecycleScripts, source: 'npm-registry', manifest: downloaded.manifest, integrity: downloaded.integrity, sha512: downloaded.sha512, registry: downloaded.registry } }
    } catch (error: unknown) {
      return { status: 'unavailable', candidate, detail: `Candidate npm artifact download failed for ${candidate}: ${error instanceof Error ? error.message : String(error)}` }
    }
  }
}
