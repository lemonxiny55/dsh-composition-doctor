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
  profile: { path: 'after', packageName: 'after' },
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
