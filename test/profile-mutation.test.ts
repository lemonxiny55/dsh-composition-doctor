import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'vitest'

import { runCli } from '../src/cli/main.js'

interface FileState {
  sha256: string
  mtimeMs: number
  size: number
}

type ProfileState = Record<string, FileState>

async function captureProfile(root: string): Promise<ProfileState> {
  const state: ProfileState = {}
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
        continue
      }
      if (!entry.isFile()) continue
      const bytes = await readFile(path)
      const metadata = await stat(path)
      state[relative(root, path).replaceAll('\\', '/')] = {
        sha256: createHash('sha256').update(bytes).digest('hex'),
        mtimeMs: metadata.mtimeMs,
        size: metadata.size
      }
    }
  }
  await visit(root)
  return state
}

async function createCanaryProfile(): Promise<{ root: string; workspace: string }> {
  const workspace = await mkdtemp(join(tmpdir(), 'dsh-profile-mutation-'))
  const root = join(workspace, 'profile')
  await (await import('node:fs/promises')).mkdir(root, { recursive: true })
  await writeFile(join(root, 'package.json'), '{"name":"mutation-fixture","private":true,"dependencies":{}}\n')
  await writeFile(join(root, 'cordis.yml'), 'plugins:\n  - id: canary-plugin\n    config:\n      enabled: true\n')
  await writeFile(join(root, 'cordis.patch.yml'), 'patches:\n  - id: canary-plugin\n    config:\n      enabled: true\n')
  await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n')
  await writeFile(join(root, 'canary.txt'), 'must-remain-byte-for-byte-unchanged\n')
  return { root, workspace }
}

async function expectUnchanged(root: string, run: (workspace: string) => Promise<void>): Promise<void> {
  const before = await captureProfile(root)
  await run(root)
  const after = await captureProfile(root)
  expect(after).toEqual(before)
  expect(after).toHaveProperty('package.json')
  expect(after).toHaveProperty('cordis.yml')
  expect(after).toHaveProperty('cordis.patch.yml')
  expect(after).toHaveProperty('pnpm-lock.yaml')
  expect(after).toHaveProperty('canary.txt')
  expect(Object.keys(after).some((path) => path === 'node_modules' || path.startsWith('node_modules/'))).toBe(false)
}

describe('profile mutation guard', () => {
  test.each([
    ['scan', async (root: string, workspace: string) => {
      const output = join(workspace, 'scan-output')
      expect(await runCli(['scan', '--profile', root, '--output', output], { write: () => undefined })).toBe(0)
      expect(JSON.parse(await readFile(join(output, 'report.json'), 'utf8'))).toMatchObject({ schemaVersion: 1, evidenceSchemaVersion: 2 })
    }],
    ['snapshot', async (root: string, workspace: string) => {
      const output = join(workspace, 'snapshot.json')
      expect(await runCli(['snapshot', '--profile', root, '--output', output], { write: () => undefined })).toBe(0)
      expect(JSON.parse(await readFile(output, 'utf8'))).toMatchObject({ schemaVersion: 2 })
    }],
    ['preflight', async (root: string, workspace: string) => {
      const output = join(workspace, 'preflight.json')
      expect(await runCli(['preflight', '--profile', root, '--target-dsh', '0.1.5-rc.1', '--output', output], { write: () => undefined })).toBe(0)
      const result = JSON.parse(await readFile(output, 'utf8')) as { evidence: Array<{ subject?: string; detail: string }>; runtimeSmoke: { outcome: string } }
      expect(result.evidence.some((item) => item.subject === 'target-artifact' && (item.detail.includes('unavailable') || item.detail.includes('not verified') || item.detail.includes('not implemented')))).toBe(true)
      expect(result.runtimeSmoke.outcome).toBe('not-run')
    }]
  ])('%s leaves the real profile byte-for-byte unchanged', async (_name, command) => {
    const { root, workspace } = await createCanaryProfile()
    try {
      await expectUnchanged(root, async () => command(root, workspace))
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })
})
