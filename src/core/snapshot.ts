import { basename, isAbsolute } from 'node:path'

import type { BundleFact, CompositionModel, HookRegistration, InstalledPackageFact, PeerRequirement, PlatformRequirement, ProfileInput, UiClaim } from './types.js'
import { analyseComposition } from './rules.js'
import { resolveComposition } from './composition-adapter.js'

export interface SnapshotPlugin { name: string; version?: string; source: string }
export interface SnapshotRow { id?: string; name?: string; source: string; layer?: string; configKeys?: readonly string[]; replacement?: boolean }
export interface SnapshotConflict { id: string; severity: 'info' | 'warning' | 'error'; subjects: readonly string[] }
export interface InstalledPackageSnapshot {
  name: string
  requestedSpec?: string
  installedVersion?: string
  packageJsonSource: string
  bundlePatch?: string
  repository?: string
  gitRef?: string
  integrity?: string
  platform?: readonly string[]
  peerDsh?: string
  peerCordis?: string
  engineNode?: string
}

export interface SnapshotV2 {
  schemaVersion: 2
  doctorVersion: string
  runtime: { dsh?: string; cordis?: string; node: string; platform: string }
  profile: { name?: string; manifestHash?: string }
  packages: readonly InstalledPackageSnapshot[]
  rows: readonly SnapshotRow[]
  hooks: readonly Pick<HookRegistration, 'hook' | 'source' | 'packageName' | 'version'>[]
  uiClaims: readonly Pick<UiClaim, 'kind' | 'value' | 'source' | 'packageName' | 'version' | 'mode' | 'contributionId'>[]
  conflicts: readonly SnapshotConflict[]
  packageManager: { kind?: 'pnpm' | 'npm' | 'yarn'; lockfileHash?: string }
  /** Hash-only compatibility field for existing consumers. */
  hashes: Readonly<Record<string, string>>
}

export interface SnapshotV1 {
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

export type Snapshot = SnapshotV1 | SnapshotV2

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function slashPath(value: string): string { return value.replaceAll('\\', '/') }
function isWindowsAbsolute(value: string): boolean { return /^[A-Za-z]:\//.test(value) }
function normalizedSource(source: string, profileDir: string): string {
  const normalized = slashPath(source)
  const root = slashPath(profileDir).replace(/\/+$/, '')
  if (!isAbsolute(source) && !isWindowsAbsolute(normalized)) return normalized
  if (normalized === root) return '<PROFILE>'
  const prefix = `${root}/`
  return normalized.startsWith(prefix) ? `<PROFILE>/${normalized.slice(prefix.length)}` : `<EXTERNAL>/${basename(normalized)}`
}
function sortJson<T>(values: readonly T[]): T[] { return [...values].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))) }
function packageSnapshot(fact: InstalledPackageFact): InstalledPackageSnapshot {
  return {
    name: fact.name,
    ...(fact.requestedSpec === undefined ? {} : { requestedSpec: fact.requestedSpec }),
    ...(fact.installedVersion === undefined ? {} : { installedVersion: fact.installedVersion }),
    packageJsonSource: `<BUNDLE:${fact.name}>/package.json`,
    ...(fact.bundlePatch === undefined ? {} : { bundlePatch: `<BUNDLE:${fact.name}>/${basename(fact.bundlePatch)}` }),
    ...(fact.repository === undefined ? {} : { repository: fact.repository }),
    ...(fact.gitRef === undefined ? {} : { gitRef: fact.gitRef }),
    ...(fact.integrity === undefined ? {} : { integrity: fact.integrity }),
    ...(fact.platform === undefined ? {} : { platform: [...fact.platform].sort() }),
    ...(fact.peerDsh === undefined ? {} : { peerDsh: fact.peerDsh }),
    ...(fact.peerCordis === undefined ? {} : { peerCordis: fact.peerCordis }),
    ...(fact.engineNode === undefined ? {} : { engineNode: fact.engineNode })
  }
}
function packageFromBundle(bundle: BundleFact, profileDir: string): InstalledPackageSnapshot {
  return { name: bundle.name, ...(bundle.requestedSpec === undefined ? {} : { requestedSpec: bundle.requestedSpec }), ...(bundle.version === undefined ? {} : { installedVersion: bundle.version }), packageJsonSource: normalizedSource(bundle.source, profileDir), ...(bundle.repository === undefined ? {} : { repository: bundle.repository }), ...(bundle.gitRef === undefined ? {} : { gitRef: bundle.gitRef }), ...(bundle.integrity === undefined ? {} : { integrity: bundle.integrity }) }
}
function lockKind(input: ProfileInput | undefined): { kind?: 'pnpm' | 'npm' | 'yarn'; lockfileHash?: string } {
  const file = input?.files.find((item) => ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'].includes(item.relativePath))
  if (file === undefined) return {}
  return { kind: file.relativePath === 'pnpm-lock.yaml' ? 'pnpm' : file.relativePath === 'yarn.lock' ? 'yarn' : 'npm', lockfileHash: file.sha256 }
}

function snapshotFromModel(model: CompositionModel, input?: ProfileInput): SnapshotV2 {
  const profileDir = model.profileDir
  const report = analyseComposition(model)
  const manifest = input?.files.find((candidate) => candidate.relativePath === 'package.json')
  let profileName: string | undefined
  try { profileName = manifest === undefined ? undefined : ((JSON.parse(manifest.text) as { name?: unknown }).name as string | undefined) } catch { /* hash-only metadata is still valid */ }
  const packages = model.installedPackages?.map(packageSnapshot) ?? model.bundles?.map((bundle) => packageFromBundle(bundle, profileDir)) ?? []
  const hashes = Object.fromEntries((input?.files ?? []).filter((file) => ['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'].includes(file.relativePath)).map((file) => [file.relativePath, file.sha256]))
  return {
    schemaVersion: 2,
    doctorVersion: '0.1.3',
    runtime: { ...(model.runtime?.dsh === undefined ? {} : { dsh: model.runtime.dsh }), ...(model.runtime?.cordis === undefined ? {} : { cordis: model.runtime.cordis }), node: model.runtime?.node ?? process.versions.node, platform: model.runtime?.platform ?? process.platform },
    profile: { ...(profileName === undefined ? {} : { name: profileName }), ...(manifest === undefined ? {} : { manifestHash: manifest.sha256 }) },
    packages: sortJson(packages),
    rows: model.rows.map((row) => ({ ...(row.id === undefined ? {} : { id: row.id }), ...(row.name === undefined ? {} : { name: row.name }), source: normalizedSource(row.source, profileDir), ...(row.layer === undefined ? {} : { layer: row.layer }), ...(row.configKeys === undefined ? {} : { configKeys: [...row.configKeys].sort() }), ...(row.replacement === true ? { replacement: true } : {}) })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    hooks: sortJson((model.hooks ?? []).map(({ hook, source, packageName, version }) => ({ hook, source: normalizedSource(source, profileDir), ...(packageName === undefined ? {} : { packageName }), ...(version === undefined ? {} : { version }) }))),
    uiClaims: sortJson((model.uiClaims ?? []).map(({ kind, value, source, packageName, version, mode, contributionId }) => ({ kind, value, source: normalizedSource(source, profileDir), ...(packageName === undefined ? {} : { packageName }), ...(version === undefined ? {} : { version }), ...(mode === undefined ? {} : { mode }), ...(contributionId === undefined ? {} : { contributionId }) }))),
    conflicts: sortJson(report.diagnostics.map((item) => ({ id: item.id, severity: item.severity, subjects: item.evidence.map((entry) => `${normalizedSource(entry.source, profileDir)}:${entry.subject ?? ''}`).sort() }))),
    packageManager: lockKind(input),
    hashes
  }
}

export async function createSnapshot(input: ProfileInput | CompositionModel): Promise<SnapshotV2> {
  if ('files' in input) return snapshotFromModel(await resolveComposition(input), input)
  return snapshotFromModel(input)
}
export function isSnapshotV2(value: unknown): value is SnapshotV2 { return isRecord(value) && value.schemaVersion === 2 && Array.isArray(value.packages) && isRecord(value.profile) }
export function isSnapshotV1(value: unknown): value is SnapshotV1 { return isRecord(value) && value.schemaVersion === 1 && Array.isArray(value.plugins) }
export function legacyPlugins(snapshot: Snapshot): readonly SnapshotPlugin[] {
  if (isSnapshotV1(snapshot)) return snapshot.plugins
  return snapshot.packages.map((item) => ({ name: item.name, ...(item.installedVersion === undefined ? {} : { version: item.installedVersion }), source: item.packageJsonSource }))
}
