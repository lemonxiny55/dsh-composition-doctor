import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { runCli, type CliIo } from '../src/cli/main.js'
import { diffSnapshots } from '../src/core/diff.js'
import { analyseComposition } from '../src/core/rules.js'
import { createSnapshot } from '../src/core/snapshot.js'
import { readProfile } from '../src/core/profile-reader.js'
import { resolveComposition } from '../src/core/composition-adapter.js'
import { redact, redactYamlPreservingTags } from '../src/core/redaction.js'
import { renderJson } from '../src/reports/json.js'
import { renderMarkdown } from '../src/reports/markdown.js'
import { resolveDshArtifact } from '../src/core/preflight/artifact-resolver.js'
import { downloadNpmArtifact, tarManifest } from '../src/core/preflight/npm-artifact.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

function archive(entries: readonly { name: string; content?: string; type?: number }[]): Buffer {
  const blocks: Buffer[] = []
  for (const entry of entries) {
    const content = Buffer.from(entry.content ?? '', 'utf8')
    const header = Buffer.alloc(512)
    header.write(entry.name, 0, 'utf8')
    header.write(`${content.length.toString(8).padStart(11, '0')} `, 124, 'ascii')
    header[156] = entry.type ?? 48
    const padded = Buffer.alloc(Math.ceil(content.length / 512) * 512)
    content.copy(padded)
    blocks.push(header, padded)
  }
  blocks.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(blocks))
}

function packageArchive(extra = ''): Buffer {
  return archive([{ name: 'package/package.json', content: JSON.stringify({ name: 'foo', version: '1.2.3', extra }) }])
}

function capture(): { io: CliIo; lines: string[] } {
  const lines: string[] = []
  return { io: { write: (line) => lines.push(line) }, lines }
}

describe('release hardening', () => {
  test('rejects unsafe tar paths and link entries without extraction', () => {
    expect(() => tarManifest(archive([
      { name: 'package/package.json', content: JSON.stringify({ name: 'foo', version: '1.2.3' }) },
      { name: '../../evil.txt', content: 'must not be written' }
    ]))).toThrow(/unsafe path/)
    expect(() => tarManifest(archive([{ name: 'package/link', type: 50 }]))).toThrow(/link entry/)
  })

  test('does not follow a malicious bundle package path outside the profile', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doctor-path-'))
    temporaryDirectories.push(root)
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'path-test', dsh: { profile: { bundles: [{ name: '../outside-package' }, { name: 'C:/outside-package' }] } } }))
    const input = await readProfile({ profileDir: root })
    expect(input.installedPackages).toHaveLength(0)
    expect(input.inventoryDiagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'bundle-not-installed' })]))
  })

  test('redacts sensitive fields across report, snapshot, markdown, and diff surfaces', async () => {
    const sentinel = 'DOCTOR_MUST_NOT_LEAK_7c92'
    const value = {
      apiKey: sentinel, api_key: sentinel, token: sentinel, accessToken: sentinel, refreshToken: sentinel,
      password: sentinel, secret: sentinel, Authorization: `Bearer ${sentinel}`, cookie: sentinel,
      privateKey: sentinel, environment: { SECRET_TOKEN: sentinel }
    }
    expect(JSON.stringify(redact(value))).not.toContain(sentinel)
    expect(redactYamlPreservingTags(`config:\n  apiKey: ${sentinel}\n  cookie: ${sentinel}\n  handler: !!js "handlerValue"\n`)).not.toContain(sentinel)
    expect(redactYamlPreservingTags(`config:\n  apiKey: !!js "${sentinel}"\n`)).not.toContain(sentinel)

    const root = await mkdtemp(join(tmpdir(), 'dsh-doctor-redaction-'))
    temporaryDirectories.push(root)
    await writeFile(join(root, 'cordis.yml'), `plugins:\n  - id: redacted\n    config:\n      apiKey: ${sentinel}\n      accessToken: ${sentinel}\n      cookie: ${sentinel}\n`)
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'redaction-test', secret: sentinel }))
    const input = await readProfile({ profileDir: root })
    const model = await (await import('../src/core/composition-adapter.js')).resolveComposition(input)
    const report = analyseComposition(model)
    const snapshot = await createSnapshot(input)
    const outputs = [renderJson(report), renderMarkdown(report), JSON.stringify(snapshot), JSON.stringify(diffSnapshots(snapshot, snapshot))]
    expect(outputs.every((output) => !output.includes(sentinel))).toBe(true)
  })

  test('does not execute or escape on malformed, unknown-tag, alias, deep, or large YAML inputs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doctor-yaml-'))
    temporaryDirectories.push(root)
    const cases = [
      'plugins: [',
      'plugins:\n  - id: unknown\n    config: !not-allowed value',
      'plugins:\n  - id: alias\n    config: &config { value: safe }\n  - id: alias-copy\n    config: *config',
      `plugins:\n  - id: deep\n    config:\n${Array.from({ length: 64 }, (_, index) => `${' '.repeat((index + 2) * 2)}level${index}:`).join('\n')}\n${' '.repeat(132)}value`,
      `plugins:\n  - id: large\n    config:\n      value: ${'x'.repeat(256 * 1024)}`
    ]
    for (const [index, text] of cases.entries()) {
      await writeFile(join(root, 'cordis.yml'), text)
      const input = await readProfile({ profileDir: root })
      await expect(resolveComposition(input)).resolves.toBeDefined()
      if (index === 0) {
        await expect(resolveComposition(input)).resolves.toMatchObject({ adapterDiagnostics: expect.arrayContaining([expect.objectContaining({ id: 'composition-parse-failed' })]) })
      }
    }
  })

  test('keeps snapshots deterministic and path-independent', async () => {
    const firstRoot = await mkdtemp(join(tmpdir(), 'dsh-doctor-determinism-a-'))
    const secondRoot = await mkdtemp(join(tmpdir(), 'dsh-doctor-determinism-b-'))
    temporaryDirectories.push(firstRoot, secondRoot)
    await cp(resolve('test/fixtures/healthy'), firstRoot, { recursive: true, force: true })
    await cp(resolve('test/fixtures/healthy'), secondRoot, { recursive: true, force: true })
    const first = await createSnapshot(await readProfile({ profileDir: firstRoot }))
    const second = await createSnapshot(await readProfile({ profileDir: secondRoot }))
    expect(second).toEqual(first)
    expect(diffSnapshots(first, second)).toMatchObject({ pluginChanges: [], rowChanges: [], hookChanges: [], uiConflictChanges: [], peerChanges: [], platformChanges: [] })
    expect(await createSnapshot(await readProfile({ profileDir: firstRoot }))).toEqual(first)
  })

  test('publishes concurrent downloads atomically and rejects a corrupt cached artifact', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doctor-cache-'))
    temporaryDirectories.push(root)
    const bytes = packageArchive()
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url === 'https://registry.npmjs.org/foo') return new Response(JSON.stringify({ versions: { '1.2.3': { dist: { tarball: 'https://registry.npmjs.org/foo/-/foo-1.2.3.tgz', integrity } } } }), { headers: { 'content-type': 'application/json' } })
      return new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } })
    }))
    await Promise.all([
      downloadNpmArtifact('foo@1.2.3', root),
      downloadNpmArtifact('foo@1.2.3', root)
    ])
    const names = await readdir(root)
    expect(names.filter((name) => name.endsWith('.partial'))).toHaveLength(0)
    expect(names).toEqual(expect.arrayContaining(['foo-1.2.3.tgz', 'foo-1.2.3.tgz.metadata.json']))

    await writeFile(join(root, 'foo-1.2.3.tgz'), packageArchive('corrupted-but-parseable'))
    await expect(resolveDshArtifact({ targetDsh: '1.2.3', online: false, cacheDir: root })).resolves.toMatchObject({ kind: 'unavailable', source: 'unavailable' })
  })

  test('keeps malformed online artifacts out of cache', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doctor-cache-failure-'))
    temporaryDirectories.push(root)
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url === 'https://registry.npmjs.org/foo') return new Response(JSON.stringify({ versions: { '1.2.3': { dist: { tarball: 'https://registry.npmjs.org/foo/-/foo-1.2.3.tgz' } } } }), { headers: { 'content-type': 'application/json' } })
      return new Response(archive([{ name: '../../evil', content: 'unsafe' }]), { headers: { 'content-type': 'application/octet-stream' } })
    }))
    await expect(downloadNpmArtifact('foo@1.2.3', root)).rejects.toThrow(/unsafe path/)
    expect(await readdir(root)).toEqual([])
  })

  test('defines CLI exit thresholds and machine-readable preflight output', async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), 'dsh-doctor-cli-contract-'))
    temporaryDirectories.push(outputRoot)
    const profile = resolve('test/fixtures/healthy')
    for (const [threshold, expected] of [['never', 0], ['error', 0], ['warning', 1], ['info', 1] ] as const) {
      const output = capture()
      await expect(runCli(['scan', '--profile', profile, '--format', 'json', '--output', join(outputRoot, threshold), '--fail-on', threshold], output.io)).resolves.toBe(expected)
    }
    const invalid = capture()
    await expect(runCli(['scan', '--profile', profile, '--format', 'json', '--output', join(outputRoot, 'invalid'), '--fail-on', 'bad'], invalid.io)).resolves.toBe(2)
    const missing = capture()
    await expect(runCli(['scan', '--profile', join(outputRoot, 'missing'), '--format', 'json', '--output', join(outputRoot, 'missing-report')], missing.io)).resolves.toBe(1)
    const snapshotMissing = capture()
    await expect(runCli(['snapshot', '--profile', profile], snapshotMissing.io)).resolves.toBe(2)
    const corrupt = join(outputRoot, 'corrupt.json')
    await writeFile(corrupt, '{not-json')
    const corruptOutput = capture()
    await expect(runCli(['diff', '--before', corrupt, '--after', corrupt], corruptOutput.io)).resolves.toBe(1)
    const unsupported = join(outputRoot, 'unsupported.json')
    await writeFile(unsupported, JSON.stringify({ schemaVersion: 99 }))
    const unsupportedOutput = capture()
    await expect(runCli(['diff', '--before', unsupported, '--after', unsupported], unsupportedOutput.io)).resolves.toBe(2)
    const jsonOutput = capture()
    await expect(runCli(['preflight', '--profile', resolve('test/fixtures/preflight-real-profile'), '--target-dsh', '0.1.5-rc.1'], jsonOutput.io)).resolves.toBe(0)
    expect(jsonOutput.lines).toHaveLength(1)
    expect(JSON.parse(jsonOutput.lines[0]!)).toMatchObject({ runtimeSmoke: { outcome: 'not-run' } })
  })

  test('does not follow a cache symlink outside the cache root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doctor-cache-link-'))
    const outside = await mkdtemp(join(tmpdir(), 'dsh-doctor-cache-outside-'))
    temporaryDirectories.push(root, outside)
    await writeFile(join(outside, 'foo-1.2.3.tgz'), packageArchive())
    try {
      await symlink(join(outside, 'foo-1.2.3.tgz'), join(root, 'foo-1.2.3.tgz'))
    } catch {
      return
    }
    await expect(resolveDshArtifact({ targetDsh: '1.2.3', online: false, cacheDir: root })).resolves.toMatchObject({ kind: 'unavailable' })
  })
})
