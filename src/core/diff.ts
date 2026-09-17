import { compare as semverCompare } from 'semver'

import type { Snapshot, SnapshotPlugin, SnapshotV1, SnapshotV2 } from './snapshot.js'
import { isSnapshotV1, isSnapshotV2, legacyPlugins } from './snapshot.js'

export type ChangeKind = 'added' | 'removed' | 'upgraded' | 'downgraded' | 'changed'
export interface SnapshotChange<T> { kind: ChangeKind; key: string; before?: T; after?: T }
export interface PluginChange extends SnapshotChange<SnapshotPlugin> { name: string }
export interface SnapshotDiff {
  pluginChanges: readonly PluginChange[]
  rowChanges: readonly SnapshotChange<SnapshotV2['rows'][number]>[]
  hookChanges: readonly SnapshotChange<SnapshotV2['hooks'][number]>[]
  uiConflictChanges: readonly SnapshotChange<SnapshotV2['uiClaims'][number]>[]
  peerChanges: readonly SnapshotChange<unknown>[]
  platformChanges: readonly SnapshotChange<unknown>[]
  upgradeRisk: { summary: string; items: readonly string[] }
}

function formatChange(change: SnapshotChange<unknown>): string {
  const before = change.before === undefined ? '' : ` before=${JSON.stringify(change.before)}`
  const after = change.after === undefined ? '' : ` after=${JSON.stringify(change.after)}`
  return `- **${change.kind}** \`${change.key}\`${before}${after}`
}
export function renderSnapshotDiffMarkdown(diff: SnapshotDiff): string {
  const sections: readonly [string, readonly SnapshotChange<unknown>[]][] = [['Plugins', diff.pluginChanges], ['Cordis rows', diff.rowChanges], ['Tool hooks', diff.hookChanges], ['UI claims', diff.uiConflictChanges], ['Peer requirements', diff.peerChanges], ['Platform requirements', diff.platformChanges]]
  const body = sections.map(([title, values]) => `## ${title}\n\n${values.length === 0 ? 'No changes.' : values.map(formatChange).join('\n')}`).join('\n\n')
  const riskItems = diff.upgradeRisk.items.length === 0 ? '- None.' : diff.upgradeRisk.items.map((item) => `- ${item}`).join('\n')
  return `# DSH Composition Doctor Snapshot Diff\n\n${diff.upgradeRisk.summary}\n\n## Upgrade risk items\n\n${riskItems}\n\n${body}\n`
}
function compareVersions(left: string | undefined, right: string | undefined): number | undefined {
  if (left === undefined || right === undefined) return undefined
  try { return semverCompare(left, right, { includePrerelease: true }) } catch { return undefined }
}
function changes<T>(before: readonly T[], after: readonly T[], beforeKey: (item: T) => string, afterKey: (item: T) => string = beforeKey): SnapshotChange<T>[] {
  const previous = new Map(before.map((item) => [beforeKey(item), item]))
  const next = new Map(after.map((item) => [afterKey(item), item]))
  const result: SnapshotChange<T>[] = []
  for (const key of [...new Set([...previous.keys(), ...next.keys()])].sort()) {
    const left = previous.get(key); const right = next.get(key)
    if (left === undefined) result.push({ kind: 'added', key, after: right })
    else if (right === undefined) result.push({ kind: 'removed', key, before: left })
    else if (JSON.stringify(left) !== JSON.stringify(right)) result.push({ kind: 'changed', key, before: left, after: right })
  }
  return result
}

interface NormalizedSnapshot {
  plugins: readonly SnapshotPlugin[]
  rows: readonly SnapshotV2['rows'][number][]
  hooks: readonly SnapshotV2['hooks'][number][]
  uiClaims: readonly SnapshotV2['uiClaims'][number][]
  peers: readonly unknown[]
  platforms: readonly unknown[]
  identityPrefix: string
}
function normalize(snapshot: Snapshot): NormalizedSnapshot {
  if (isSnapshotV2(snapshot)) {
    return {
      plugins: legacyPlugins(snapshot), rows: snapshot.rows, hooks: snapshot.hooks, uiClaims: snapshot.uiClaims,
      peers: snapshot.packages.map((item) => ({ packageName: item.name, source: item.packageJsonSource, dsh: item.peerDsh, cordis: item.peerCordis, node: item.engineNode })),
      platforms: snapshot.packages.map((item) => ({ packageName: item.name, source: item.packageJsonSource, supported: item.platform })), identityPrefix: ''
    }
  }
  return { plugins: snapshot.plugins, rows: snapshot.rows, hooks: snapshot.hooks, uiClaims: snapshot.uiClaims, peers: snapshot.peers, platforms: snapshot.platforms, identityPrefix: `${snapshot.profile.path}:${snapshot.profile.packageName ?? ''}:` }
}

export function diffSnapshots(before: Snapshot, after: Snapshot): SnapshotDiff {
  const left = normalize(before); const right = normalize(after)
  const pluginKey = (prefix: string, item: SnapshotPlugin) => `${prefix}${item.name}:${item.source}`
  const pluginChanges: PluginChange[] = changes(left.plugins, right.plugins, (item) => pluginKey(left.identityPrefix, item), (item) => pluginKey(right.identityPrefix, item)).map((change) => {
    const name = change.before?.name ?? change.after?.name ?? change.key
    if (change.kind !== 'changed') return { ...change, name }
    const comparison = compareVersions(change.before?.version, change.after?.version)
    return { ...change, name, kind: comparison === undefined ? 'changed' : comparison < 0 ? 'upgraded' : comparison > 0 ? 'downgraded' : 'changed' }
  })
  const rowChanges = changes(left.rows, right.rows, (item) => `${item.source}:${item.id ?? item.name ?? ''}`)
  const hookChanges = changes(left.hooks, right.hooks, (item) => `${item.source}:${item.hook}:${item.packageName ?? ''}`)
  const uiConflictChanges = changes(left.uiClaims, right.uiClaims, (item) => `${item.kind}:${item.value}:${item.source}`)
  const peerChanges = changes(left.peers, right.peers, (item) => `${(item as { source?: string }).source ?? ''}:${(item as { packageName?: string }).packageName ?? ''}`)
  const platformChanges = changes(left.platforms, right.platforms, (item) => `${(item as { source?: string }).source ?? ''}:${(item as { packageName?: string }).packageName ?? ''}`)
  const items = pluginChanges.filter((change) => change.kind === 'downgraded' || change.kind === 'upgraded').map((change) => `${change.kind} plugin ${change.name}`)
  if (hookChanges.length > 0) items.push('hook registrations changed; runtime ordering remains unverified')
  if (uiConflictChanges.length > 0) items.push('UI claims changed; verify ownership conflicts before upgrade')
  if (peerChanges.length > 0 || platformChanges.length > 0) items.push('peer or platform requirements changed; verify supported runtime facts')
  return { pluginChanges, rowChanges, hookChanges, uiConflictChanges, peerChanges, platformChanges, upgradeRisk: { summary: items.length === 0 ? 'No risk indicators changed within the evidence covered by these snapshots.' : `Risk indicators changed: ${items.join('; ')}. No migration was executed.`, items } }
}
