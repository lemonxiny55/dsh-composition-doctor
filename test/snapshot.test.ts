import { resolve } from 'node:path'

import { expect, test } from 'vitest'

import { readProfile } from '../src/core/profile-reader.js'
import { createSnapshot } from '../src/core/snapshot.js'

const fixture = (name: string): string => resolve('test/fixtures', name)

test('snapshot excludes secret values and records lockfile SHA-256', async () => {
  const snapshot = await createSnapshot(await readProfile({ profileDir: fixture('redaction') }))

  expect(JSON.stringify(snapshot)).not.toContain('do-not-leak')
  expect(snapshot.hashes['pnpm-lock.yaml']).toMatch(/^[a-f0-9]{64}$/)
})

test('snapshot includes only allow-listed metadata hashes', async () => {
  const snapshot = await createSnapshot(await readProfile({ profileDir: fixture('redaction') }))

  expect(Object.keys(snapshot.hashes)).toEqual(['package.json', 'pnpm-lock.yaml'])
})
