import type { Snapshot, SnapshotPlugin } from './snapshot.js'
import { satisfies as semverSatisfies } from 'semver'

export type ChangeKind = 'added' | 'removed' | 'upgraded' | 'downgraded' | 'changed'
export interface SnapshotChange<T> { kind: ChangeKind; key: string; before?: T; after?: T }
export interface PluginChange extends SnapshotChange<SnapshotPlugin> { name: string }
export interface SnapshotDiff {
  pluginChanges: readonly PluginChange[]
  rowChanges: readonly SnapshotChange<Snapshot['rows'][number]>[]
  hookChanges: readonly SnapshotChange<Snapshot['hooks'][number]>[]
  uiConflictChanges: readonly SnapshotChange<Snapshot['uiClaims'][number]>[]
  peerChanges: readonly SnapshotChange<Snapshot['peers'][number]>[]
  platformChanges: readonly SnapshotChange<Snapshot['platforms'][number]>[]
  upgradeRisk: { summary: string; items: readonly string[] }
}

function formatChange(change: SnapshotChange<unknown>): string {
  const before = change.before === undefined ? '' : ` before=${JSON.stringify(change.before)}`
  const after = change.after === undefined ? '' : ` after=${JSON.stringify(change.after)}`
  return `- **${change.kind}** \`${change.key}\`${before}${after}`
}

/** Renders the semantic diff without hiding the evidence in a summary-only line. */
export function renderSnapshotDiffMarkdown(diff: SnapshotDiff): string {
  const sections: readonly [string, readonly SnapshotChange<unknown>[]][] = [
    ['Plugins', diff.pluginChanges],
    ['Cordis rows', diff.rowChanges],
    ['Tool hooks', diff.hookChanges],
    ['UI claims', diff.uiConflictChanges],
    ['Peer requirements', diff.peerChanges],
    ['Platform requirements', diff.platformChanges]
  ]
  const body = sections.map(([title, values]) => `## ${title}\n\n${values.length === 0 ? 'No changes.' : values.map(formatChange).join('\n')}`).join('\n\n')
  const riskItems = diff.upgradeRisk.items.length === 0 ? '- None.' : diff.upgradeRisk.items.map((item) => `- ${item}`).join('\n')
  return `# DSH Composition Doctor Snapshot Diff\n\n${diff.upgradeRisk.summary}\n\n## Upgrade risk items\n\n${riskItems}\n\n${body}\n`
}

function compareVersions(left: string | undefined, right: string | undefined): number | undefined {
  if (left === undefined || right === undefined) return undefined
  try {
    if (semverSatisfies(left, `<${right}`, { includePrerelease: true })) return -1
    if (semverSatisfies(left, `>${right}`, { includePrerelease: true })) return 1
    if (semverSatisfies(left, `=${right}`, { includePrerelease: true })) return 0
    return undefined
  } catch {
    return undefined
  }
}

function changes<T>(before: readonly T[], after: readonly T[], beforeKey: (item: T) => string, afterKey: (item: T) => string = beforeKey): SnapshotChange<T>[] {
  const previous = new Map(before.map((item) => [beforeKey(item), item]))
  const next = new Map(after.map((item) => [afterKey(item), item]))
  const result: SnapshotChange<T>[] = []
  for (const itemKey of [...new Set([...previous.keys(), ...next.keys()])].sort()) {
    const left = previous.get(itemKey); const right = next.get(itemKey)
    if (left === undefined) result.push({ kind: 'added', key: itemKey, after: right })
    else if (right === undefined) result.push({ kind: 'removed', key: itemKey, before: left })
    else if (JSON.stringify(left) !== JSON.stringify(right)) result.push({ kind: 'changed', key: itemKey, before: left, after: right })
  }
  return result
}

export function diffSnapshots(before: Snapshot, after: Snapshot): SnapshotDiff {
  const pluginKey = (profile: Snapshot['profile'], item: SnapshotPlugin) => `${profile.path}:${profile.packageName ?? ''}:${item.name}:${item.source}`
  const pluginChanges: PluginChange[] = changes(before.plugins, after.plugins, (item) => pluginKey(before.profile, item), (item) => pluginKey(after.profile, item)).map((change) => {
    const name = change.before?.name ?? change.after?.name ?? change.key
    if (change.kind !== 'changed') return { ...change, name }
    const comparison = compareVersions(change.before?.version, change.after?.version)
    return { ...change, name, kind: comparison === undefined ? 'changed' : comparison < 0 ? 'upgraded' : comparison > 0 ? 'downgraded' : 'changed' }
  })
  const rowChanges = changes(before.rows, after.rows, (item) => `${item.source}:${item.id ?? item.name ?? ''}`)
  const hookChanges = changes(before.hooks, after.hooks, (item) => `${item.source}:${item.hook}:${item.packageName ?? ''}`)
  const uiConflictChanges = changes(before.uiClaims, after.uiClaims, (item) => `${item.kind}:${item.value}:${item.source}`)
  const peerChanges = changes(before.peers, after.peers, (item) => `${item.source}:${item.packageName}`)
  const platformChanges = changes(before.platforms, after.platforms, (item) => `${item.source}:${item.packageName}`)
  const items = pluginChanges.filter((change) => change.kind === 'downgraded' || change.kind === 'upgraded').map((change) => `${change.kind} plugin ${change.name}`)
  if (hookChanges.length > 0) items.push('hook registrations changed; verify runtime ordering in an isolated fixture')
  if (uiConflictChanges.length > 0) items.push('UI claims changed; verify ownership conflicts before upgrade')
  if (peerChanges.length > 0 || platformChanges.length > 0) items.push('peer or platform requirements changed; verify supported runtime facts')
  return { pluginChanges, rowChanges, hookChanges, uiConflictChanges, peerChanges, platformChanges, upgradeRisk: { summary: items.length === 0 ? 'No upgrade risks detected from snapshot metadata.' : `Upgrade risk: ${items.join('; ')}. No migration was executed.`, items } }
}
