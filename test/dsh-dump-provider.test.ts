import { expect, test } from 'vitest'
import { resolve } from 'node:path'

import { tryDshDump } from '../src/core/dsh-dump-provider.js'
import { parseDshDump } from '../src/core/dsh-dump-parser.js'
import { readProfile } from '../src/core/profile-reader.js'

test('fake public dump provider returns composed rows, replacement provenance, and unmatched targets', async () => {
  const input = await readProfile({ profileDir: 'test/fixtures/healthy' })
  const result = await tryDshDump(input, { dshBin: resolve('test/fixtures/fake-dsh/dsh.mjs') })
  expect(result?.rows).toHaveLength(2)
  expect(result?.rows[1]).toMatchObject({ id: 'bundle-row', layer: 'profile', replacement: true, evidenceKind: 'composed' })
  expect(result?.diagnostics).toContainEqual(expect.objectContaining({ id: 'unmatched-patch-target' }))
})

test('dump parser keeps only config key structure and does not retain config values in row provenance', () => {
  const result = parseDshDump(JSON.stringify({ rows: [{ id: 'r', config: { token: 'secret', enabled: true } }] }))
  expect(result.rows[0]).toMatchObject({ id: 'r', configKeys: ['enabled', 'token'] })
})

test('successful dump-config with !!js remains composed and adds a runtime-unknown diagnostic', async () => {
  const input = await readProfile({ profileDir: 'test/fixtures/custom-yaml-tag-js' })
  const result = await tryDshDump(input, { dshBin: resolve('test/fixtures/fake-dsh/dsh.mjs') })

  expect(result?.rows.every((row) => row.evidenceKind === 'composed')).toBe(true)
  expect(result?.rows.some((row) => row.evidenceKind === 'runtime-observed')).toBe(false)
  expect(result?.diagnostics).toContainEqual(expect.objectContaining({ id: 'runtime-behavior-unverified', severity: 'warning' }))
})
