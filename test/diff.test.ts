import { expect, test } from 'vitest'

import { diffSnapshots } from '../src/core/diff.js'
import type { Snapshot } from '../src/core/snapshot.js'

const before: Snapshot = {
  schemaVersion: 1,
  profile: { path: 'before', packageName: 'before' },
  plugins: [{ name: 'example', version: '2.0.0', source: 'package.json' }],
  rows: [{ id: 'old-row', name: 'example', source: 'cordis.yml' }],
  hooks: [{ hook: 'tools/execute', source: 'cordis.yml' }],
  uiClaims: [{ kind: 'sidebar', value: 'old', source: 'cordis.yml' }],
  peers: [{ packageName: 'example', source: 'package.json', dsh: '>=0.1.0' }],
  platforms: [{ packageName: 'example', source: 'package.json', supported: ['win32'] }],
  bundles: [],
  hashes: {}
}

const after: Snapshot = {
  ...before,
  profile: { path: 'before', packageName: 'before' },
  plugins: [{ name: 'example', version: '1.0.0', source: 'package.json' }],
  rows: [{ id: 'new-row', name: 'example', source: 'cordis.yml' }],
  hooks: [{ hook: 'tools/result', source: 'cordis.yml' }],
  uiClaims: [{ kind: 'sidebar', value: 'new', source: 'cordis.yml' }],
  peers: [{ packageName: 'example', source: 'package.json', dsh: '>=0.2.0' }],
  platforms: [{ packageName: 'example', source: 'package.json', supported: ['linux'] }]
}

test('diff classifies a plugin version decrease as a downgrade', () => {
  expect(diffSnapshots(before, after).pluginChanges)
    .toContainEqual(expect.objectContaining({ kind: 'downgraded', name: 'example' }))
})

test('diff reports structural changes and upgrade risk without migrations', () => {
  const diff = diffSnapshots(before, after)

  expect(diff.rowChanges).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'removed' }), expect.objectContaining({ kind: 'added' })]))
  expect(diff.hookChanges).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'removed' }), expect.objectContaining({ kind: 'added' })]))
  expect(diff.uiConflictChanges).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'removed' }), expect.objectContaining({ kind: 'added' })]))
  expect(diff.peerChanges).toHaveLength(1)
  expect(diff.platformChanges).toHaveLength(1)
  expect(diff.upgradeRisk.summary).toContain('downgrade')
})

test('diff retains same-name plugins from distinct profiles and sources and compares prereleases', () => {
  const left: Snapshot = { ...before, plugins: [
    { name: 'example', version: '1.0.0-rc.2', source: 'a/package.json' },
    { name: 'example', version: '1.0.0', source: 'b/package.json' }
  ] }
  const right: Snapshot = { ...left, plugins: [
    { name: 'example', version: '1.0.0-rc.10', source: 'a/package.json' },
    { name: 'example', version: '1.0.0', source: 'moved/package.json' }
  ] }
  const changes = diffSnapshots(left, right).pluginChanges

  expect(changes).toContainEqual(expect.objectContaining({ kind: 'upgraded', name: 'example', key: expect.stringContaining('a/package.json') }))
  expect(changes.filter((item) => item.name === 'example')).toHaveLength(3)
  expect(changes.map((item) => item.key).join('\n')).toContain('a/package.json')
  expect(changes.map((item) => item.key).join('\n')).toContain('moved/package.json')
})

test('diff treats the same package in a different profile as a separate plugin identity', () => {
  const changedProfile: Snapshot = { ...after, profile: { path: 'after', packageName: 'after' } }
  const changes = diffSnapshots(before, changedProfile).pluginChanges

  expect(changes).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'removed', key: expect.stringContaining('before') }),
    expect.objectContaining({ kind: 'added', key: expect.stringContaining('after') })
  ]))
})
