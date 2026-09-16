import type { BundleFact, CompositionModel, HookRegistration, PeerRequirement, PlatformRequirement, ProfileInput, UiClaim } from './types.js'
import { resolveComposition } from './composition-adapter.js'

export interface SnapshotPlugin {
  name: string
  version?: string
  source: string
}

export interface SnapshotRow {
  id?: string
  name?: string
  source: string
}

export interface Snapshot {
  schemaVersion: 1
  profile: { path: string; packageName?: string }
  plugins: readonly SnapshotPlugin[]
  rows: readonly SnapshotRow[]
  hooks: readonly Pick<HookRegistration, 'hook' | 'source' | 'packageName' | 'version'>[]
  uiClaims: readonly Pick<UiClaim, 'kind' | 'value' | 'source' | 'packageName' | 'version'>[]
  peers: readonly Pick<PeerRequirement, 'packageName' | 'source' | 'dsh' | 'cordis' | 'node'>[]
  platforms: readonly Pick<PlatformRequirement, 'packageName' | 'source' | 'supported'>[]
  bundles: readonly Pick<BundleFact, 'name' | 'version' | 'source' | 'gitRef' | 'profile'>[]
  hashes: Readonly<Record<string, string>>
}

type PackageManifest = {
  name?: unknown
  dependencies?: unknown
  devDependencies?: unknown
  peerDependencies?: unknown
  os?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stringMap(value: unknown): readonly [string, string][] {
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([name, version]): [string, string][] => typeof version === 'string' ? [[name, version]] : [])
}

function sortBySource<T extends { source: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.source.localeCompare(right.source) || JSON.stringify(left).localeCompare(JSON.stringify(right)))
}

function manifestSnapshot(input: ProfileInput): { packageName?: string; plugins: SnapshotPlugin[]; peers: Snapshot['peers']; platforms: Snapshot['platforms'] } {
  const file = input.files.find((candidate) => candidate.relativePath === 'package.json')
  if (file === undefined) return { plugins: [], peers: [], platforms: [] }
  try {
    const manifest = JSON.parse(file.text) as PackageManifest
    const packageName = typeof manifest.name === 'string' ? manifest.name : undefined
    const plugins = [...stringMap(manifest.dependencies), ...stringMap(manifest.devDependencies)]
      .map(([name, version]) => ({ name, version, source: file.relativePath }))
      .sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version))
    const peers = packageName === undefined ? [] : [{
      packageName,
      source: file.relativePath,
      ...Object.fromEntries(stringMap(manifest.peerDependencies).filter(([name]) => name === '@deepseek-ai/dsh' || name === '@deepseek-ai/cordis' || name === 'node').map(([name, range]) => [name === '@deepseek-ai/dsh' ? 'dsh' : name === '@deepseek-ai/cordis' ? 'cordis' : 'node', range]))
    }]
    const platforms = packageName === undefined || !Array.isArray(manifest.os) ? [] : [{ packageName, source: file.relativePath, supported: manifest.os.filter((platform): platform is string => typeof platform === 'string').sort() }]
    return { ...(packageName === undefined ? {} : { packageName }), plugins, peers, platforms }
  } catch {
    return { plugins: [], peers: [], platforms: [] }
  }
}

function snapshotFromModel(model: CompositionModel, profile: Snapshot['profile'], hashes: Snapshot['hashes'], plugins: readonly SnapshotPlugin[] = []): Snapshot {
  return {
    schemaVersion: 1,
    profile,
    plugins: [...plugins].sort((left, right) => left.name.localeCompare(right.name) || (left.version ?? '').localeCompare(right.version ?? '')),
    rows: model.rows.map(({ id, name, source }) => ({ ...(id === undefined ? {} : { id }), ...(name === undefined ? {} : { name }), source })).sort((left, right) => left.source.localeCompare(right.source) || (left.id ?? '').localeCompare(right.id ?? '')),
    hooks: sortBySource((model.hooks ?? []).map(({ hook, source, packageName, version }) => ({ hook, source, ...(packageName === undefined ? {} : { packageName }), ...(version === undefined ? {} : { version }) }))),
    uiClaims: sortBySource((model.uiClaims ?? []).map(({ kind, value, source, packageName, version }) => ({ kind, value, source, ...(packageName === undefined ? {} : { packageName }), ...(version === undefined ? {} : { version }) }))),
    peers: sortBySource((model.peerRequirements ?? []).map(({ packageName, source, dsh, cordis, node }) => ({ packageName, source, ...(dsh === undefined ? {} : { dsh }), ...(cordis === undefined ? {} : { cordis }), ...(node === undefined ? {} : { node }) }))),
    platforms: sortBySource((model.platforms ?? []).map(({ packageName, source, supported }) => ({ packageName, source, supported: [...supported].sort() }))),
    bundles: sortBySource((model.bundles ?? []).map(({ name, version, source, gitRef, profile: bundleProfile }) => ({ name, source, ...(version === undefined ? {} : { version }), ...(gitRef === undefined ? {} : { gitRef }), ...(bundleProfile === undefined ? {} : { profile: bundleProfile }) }))),
    hashes
  }
}

/** Creates a structural, redacted snapshot from already allow-listed profile input or a resolved model. */
export async function createSnapshot(input: ProfileInput | CompositionModel): Promise<Snapshot> {
  if ('files' in input) {
    const manifest = manifestSnapshot(input)
    const hashes = Object.fromEntries(input.files
      .filter((file) => file.relativePath === 'package.json' || file.relativePath === 'pnpm-lock.yaml' || file.relativePath === 'package-lock.json' || file.relativePath === 'yarn.lock')
      .map((file) => [file.relativePath, file.sha256]))
    return snapshotFromModel(await resolveComposition(input), { path: input.profileDir, ...(manifest.packageName === undefined ? {} : { packageName: manifest.packageName }) }, hashes, manifest.plugins)
  }
  return snapshotFromModel(input, { path: input.profileDir }, {}, input.bundles?.map(({ name, version, source }) => ({ name, source, ...(version === undefined ? {} : { version }) })) ?? [])
}
