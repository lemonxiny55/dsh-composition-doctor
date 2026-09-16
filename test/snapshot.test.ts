import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { expect, test } from 'vitest'

import { readProfile } from '../src/core/profile-reader.js'
import { createSnapshot } from '../src/core/snapshot.js'
import { runCli, type CliIo } from '../src/cli/main.js'

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

test('snapshot creates missing output parents and explicitly overwrites its destination', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-snapshot-'))
  const output = join(root, 'reports', 'before.json')
  const lines: string[] = []
  const io: CliIo = { write: (line) => lines.push(line) }
  try {
    await expect(runCli(['snapshot', '--profile', fixture('healthy'), '--output', output], io)).resolves.toBe(0)
    await expect(readFile(output, 'utf8')).resolves.toContain('schemaVersion')
    await expect(runCli(['snapshot', '--profile', fixture('healthy'), '--output', output], io)).resolves.toBe(0)
    expect(lines).toEqual([`Wrote snapshot to ${resolve(output)}`, `Wrote snapshot to ${resolve(output)}`])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
