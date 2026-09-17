import { expect, test } from 'vitest'

import { createSnapshot } from '../src/core/snapshot.js'
import { diffSnapshots } from '../src/core/diff.js'

test('snapshot v2 is path-independent and separates requested from installed versions', async () => {
  const left = await createSnapshot({ profileDir: 'C:/one/profile', rows: [], adapterDiagnostics: [], bundles: [{ name: 'example', requestedSpec: '^1.0.0', version: '1.0.0', source: 'C:/one/profile/node_modules/example/package.json', evidenceKind: 'static' }] })
  const right = await createSnapshot({ profileDir: 'D:/other/profile', rows: [], adapterDiagnostics: [], bundles: [{ name: 'example', requestedSpec: '^1.0.0', version: '1.0.0', source: 'D:/other/profile/node_modules/example/package.json', evidenceKind: 'static' }] })
  expect(left.schemaVersion).toBe(2)
  expect(left.profile).not.toHaveProperty('path')
  expect(left.packages[0]).toMatchObject({ requestedSpec: '^1.0.0', installedVersion: '1.0.0' })
  expect(diffSnapshots(left, right).pluginChanges).toEqual([])
})

test('snapshot v2 keeps lockfile hashes as evidence without treating mtime as identity', async () => {
  const snapshot = await createSnapshot({ profileDir: 'C:/fixture', rows: [], adapterDiagnostics: [], installedPackages: [{ name: 'example', installedVersion: '1.0.0', packageJsonSource: 'C:/fixture/node_modules/example/package.json', modifiedAt: new Date().toISOString() }] })
  expect(snapshot.packages[0]).not.toHaveProperty('modifiedAt')
})
