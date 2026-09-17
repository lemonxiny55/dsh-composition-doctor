import { createHash } from 'node:crypto'
import { lstat, readFile, realpath, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

import { inspectBundleInventory } from './bundle-inventory.js'
import type { ProfileFile, ProfileInput } from './types.js'

const allowedFiles = [
  'cordis.yml',
  'cordis.patch.yml',
  'package.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock'
] as const

export class ProfileDirectoryError extends Error {
  readonly code = 'PROFILE_DIRECTORY_INVALID'

  constructor(profileDir: string, reason: 'missing' | 'not-directory') {
    super(`Profile directory ${reason}: ${profileDir}`)
    this.name = 'ProfileDirectoryError'
  }
}

export async function readProfile({ profileDir }: { profileDir: string }): Promise<ProfileInput> {
  const requestedRoot = resolve(profileDir)
  let rootStats
  try {
    rootStats = await stat(requestedRoot)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ProfileDirectoryError(profileDir, 'missing')
    }
    throw error
  }
  if (!rootStats.isDirectory()) {
    throw new ProfileDirectoryError(profileDir, 'not-directory')
  }

  const resolvedRoot = await realpath(requestedRoot)
  const files: ProfileFile[] = []
  for (const relativePath of allowedFiles) {
    const candidate = resolve(requestedRoot, relativePath)
    try {
      const candidateStats = await lstat(candidate)
      if (candidateStats.isSymbolicLink() || !candidateStats.isFile()) continue

      const text = await readFile(candidate, 'utf8')
      files.push({
        relativePath,
        sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
        text
      })
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
  }

  const packageFile = files.find((file) => file.relativePath === 'package.json')
  const inventory = packageFile === undefined
    ? { packages: [], diagnostics: [] }
    : await inspectBundleInventory(resolvedRoot, packageFile.text)

  return {
    profileDir: resolvedRoot,
    files,
    installedPackages: inventory.packages,
    inventoryDiagnostics: inventory.diagnostics,
    metadataCoverage: {
      mode: 'allow-listed-root-metadata',
      scannedFiles: files.map((file) => file.relativePath).sort(),
      unscannedSurfaces: ['non-declared nested plugin manifests and non-selected package metadata', 'environment files and values', 'private keys, tokens, sessions, and workspace source files']
    }
  }
}
