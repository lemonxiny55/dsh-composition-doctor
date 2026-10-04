import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { runCli } from '../src/cli/main.js'
import { explainFailures, matchFailureSignatures, type FailureResult } from '../src/core/failure-explainer.js'
import { readFailureComposition } from '../src/core/failure-profile.js'
import { readProfile } from '../src/core/profile-reader.js'
import { analyseComposition } from '../src/core/rules.js'
import { renderFailure } from '../src/reports/failure.js'
import type { CompositionModel } from '../src/core/types.js'

const fixtureRoot = resolve('test/fixtures/failures')
const temps: string[] = []
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(temps.splice(0).map((path) => rm(path, { recursive: true, force: true }))) })
async function temp(): Promise<string> { const path = await mkdtemp(join(tmpdir(), 'doctor-failure-')); temps.push(path); return path }
function report(rows: CompositionModel['rows'] = [], extra: Partial<CompositionModel> = {}) {
  return analyseComposition({ profileDir: 'C:/private/profile', rows, adapterDiagnostics: [], evidenceMode: 'static', ...extra })
}
async function fixture(name: string) { return analyseComposition(await readFailureComposition(await readProfile({ profileDir: join(fixtureRoot, name) }))) }
async function cli(args: string[], log?: string) {
  const lines: string[] = []
  const code = await runCli(args, { write: (line) => lines.push(line), readStdin: async () => log })
  return { code, text: lines.join('\n') }
}
async function fingerprint(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile()) result[path.slice(root.length)] = `${createHash('sha256').update(await readFile(path)).digest('hex')}:${(await stat(path)).mtimeMs}`
    }
  }
  await walk(root); return result
}

describe('public failure regressions', () => {
  test('public upgrade peer case uses the independently selected host version and actual DSH warning formatter', async () => {
    const root = join(fixtureRoot, 'peer-upgrade')
    const log = await readFile(join(root, 'error.log'), 'utf8')
    const unknown = await cli(['diagnose', '--profile', root, '--format', 'json'], log)
    expect(JSON.parse(unknown.text).outcome).toBe('unknown')
    const selected = await cli(['diagnose', '--profile', root, '--format', 'json', '--dsh-version', '0.2.0-rc.1'], log)
    const result = JSON.parse(selected.text) as FailureResult
    expect(result.outcome).toBe('explained')
    expect(result.explanations[0].matchedEntity).toEqual({ kind: 'package', id: 'dshmarket' })
    expect(result.explanations[0].observableCause).toContain('@deepseek-ai/dsh-settings')
    expect(result.explanations[0].provenancePaths.some((path) => path.source.includes('dshmarket/cordis.patch.yml'))).toBe(true)
    expect(result.runtime).toBe('not-observed')
  })
  test.each(['manual-bundle-duplicate', 'missing-bundle', 'missing-patch', 'missing-target'])('%s matches signature, entity and a real metadata path', async (name) => {
    const cases = JSON.parse(await readFile(join(fixtureRoot, 'cases.json'), 'utf8'))
    const metadata = cases.find((item: { name: string }) => item.name === name)
    expect(metadata.source).toMatch(/^https:\/\/github.com\//)
    expect(matchFailureSignatures(metadata.log)).toEqual([{ pattern: metadata.pattern, entity: metadata.entity }])
    const result = explainFailures({ report: await fixture(name), log: metadata.log })
    expect(result.outcome).toBe('explained')
    expect(result.explanations[0]).toMatchObject({ matchedEntity: { id: metadata.entity }, evidenceLevel: 'static', origin: 'reported-by-log', causeStatus: 'observable-condition' })
    expect(result.explanations[0].provenancePaths.length).toBeGreaterThan(0)
    expect(JSON.stringify(result)).not.toContain(fixtureRoot)
    expect(result.runtime).toBe('not-observed')
  })
  test('duplicate case retains both exact source paths and graph row identities', async () => {
    const source = await fixture('manual-bundle-duplicate')
    const result = explainFailures({ report: source, log: 'duplicate loader entry id: session-cleaner' })
    const paths = result.explanations[0].provenancePaths
    expect(paths).toHaveLength(2)
    expect(paths.map((path) => path.source).sort()).toEqual(['<PROFILE>/node_modules/session-cleaner/cordis.patch.yml', 'cordis.patch.yml'])
    expect(paths.find((path) => path.packageName === 'session-cleaner')?.provenance[0]).toMatchObject({ source: 'session-cleaner', relation: 'introduced' })
    expect(paths.every((path) => source.compositionFacts?.nodes.some((node) => node.id === path.rowKey))).toBe(true)
  })
  test.each(['manual-bundle-duplicate', 'missing-bundle', 'missing-patch', 'missing-target'])('the same %s log with no evidence remains unknown', async (name) => {
    const log = await readFile(join(fixtureRoot, name, 'error.log'), 'utf8')
    const result = explainFailures({ report: report(), log })
    expect(result.outcome).toBe('unknown')
    expect(result.explanations.every((item) => item.causeStatus === 'unknown')).toBe(true)
    expect(result.explanations[0].evidenceLevel).toBe('unknown')
  })
})

describe('failure matching boundaries', () => {
  test.each(['garbage\u0000\ud800', 'a'.repeat(10000), 'unrelated startup failure', '{"error":', 'duplicate loader entry id: ../../.env', 'duplicate loader entry id: secret-token'])('malformed or unknown log is not evidence (case %#)', (log) => {
    const result = explainFailures({ report: report(), log })
    expect(result.outcome).toBe('no-match')
    expect(result.explanations).toEqual([])
    expect(result.nextStep).toContain('profile')
  })
  test('a known id or a normal update is not a duplicate loading path', () => {
    const source = report([
      { id: 'foo', source: 'bundle', operation: 'insert', evidenceKind: 'static' },
      { id: 'foo', source: 'cordis.patch.yml', operation: 'update', configKeys: ['enabled'], evidenceKind: 'static' }
    ])
    const result = explainFailures({ report: source, log: 'Error: duplicate loader entry id: foo' })
    expect(result.outcome).toBe('unknown')
    expect(result.explanations[0].observableCause).toContain('unknown')
  })
  test('a patched provenance chain does not prove two insertions or whole-config replacement', () => {
    const source = report([{ id: 'foo', source: 'base', provenance: ['base', 'patch'], replacement: true, replacementBasis: 'derived', evidenceKind: 'composed' }], { evidenceMode: 'composed' })
    expect(explainFailures({ report: source, log: 'duplicate loader entry id: foo' }).outcome).toBe('unknown')
    const config = explainFailures({ report: source }).explanations.find((item) => item.pattern === 'config-replacement')!
    expect(config.observableCause).toContain('Whole-config replacement is unknown')
  })
  test('same-layer inserts retain independent keys and both paths', () => {
    const source = report([1, 2].map(() => ({ id: 'foo', source: 'patch', layer: 'patch', layerOrder: 0, operation: 'insert' as const, evidenceKind: 'static' as const })))
    expect(new Set(source.compositionFacts?.rows.map((row) => row.key)).size).toBe(2)
    expect(explainFailures({ report: source, log: 'duplicate loader entry id: foo' }).explanations[0].provenancePaths).toHaveLength(2)
  })
  test('several ids are explained separately without selecting a guessed entity', () => {
    const log = 'duplicate loader entry id: foo\nduplicate loader entry id: bar\nERR_PNPM_PEER_DEP_ISSUES'
    const result = explainFailures({ report: report(), log })
    expect(result.explanations).toHaveLength(3)
    expect(result.explanations[2].matchedEntity).toBeUndefined()
    expect(result.explanations[2].unknowns.join(' ')).toContain('multiple packages')
  })
  test('logs cannot supply a peer runtime version', () => {
    const source = report([], { peerRequirements: [{ packageName: 'old-plugin', source: 'package.json', evidenceKind: 'static', dsh: '<0.2.0' }] })
    const log = 'incompatible-version: old-plugin runtimeVersion=0.2.0-rc.2'
    expect(explainFailures({ report: source, log }).outcome).toBe('unknown')
    const known = report([], { peerRequirements: [{ packageName: 'old-plugin', source: 'package.json', evidenceKind: 'static', dsh: '<0.1.7' }], runtime: { dsh: '0.2.0-rc.2' } })
    expect(explainFailures({ report: known, log }).outcome).toBe('explained')
  })
  test('known peer mismatches in multiple packages do not resolve an ambiguous log', () => {
    const source = report([], { peerRequirements: ['one', 'two'].map((packageName) => ({ packageName, source: 'package.json', evidenceKind: 'static' as const, dsh: '<0.1.7' })), runtime: { dsh: '0.2.0-rc.2' } })
    expect(explainFailures({ report: source, log: 'ERR_PNPM_PEER_DEP_ISSUES' }).outcome).toBe('unknown')
    expect(explainFailures({ report: source }).explanations).toHaveLength(2)
  })
  test('replacement compares structural declarations without exposing values or removed runtime keys', async () => {
    const source = await fixture('manual-bundle-duplicate')
    const model = await readFailureComposition(await readProfile({ profileDir: join(fixtureRoot, 'manual-bundle-duplicate') }))
    const updated = report([...model.rows.slice(0, 1), { id: 'session-cleaner', source: 'cordis.patch.yml', layer: 'profile', layerOrder: 2,
      operation: 'update', configKeys: ['mode'], replacement: true, replacementBasis: 'derived', evidenceKind: 'static' }], { installedPackages: model.installedPackages })
    const result = explainFailures({ report: updated })
    expect(result.explanations.find((item) => item.pattern === 'config-replacement')?.observableCause).toContain('replace the whole config')
    expect(source.compositionFacts?.rows.every((row) => row.removedConfigKeys === undefined)).toBe(true)
  })
  test('composed duplicate evidence is distinguished from static findings', () => {
    const source = report(['a', 'b'].map((source) => ({ id: 'foo', source, evidenceKind: 'composed' as const })), { evidenceMode: 'composed' })
    expect(explainFailures({ report: source, log: 'duplicate loader entry id: foo' }).explanations[0].evidenceLevel).toBe('composed')
    expect(explainFailures({ report: source }).explanations[0]).toMatchObject({ pattern: 'duplicate-loader-entry', evidenceLevel: 'composed', origin: 'observed-from-composition' })
  })
  test('legacy reports and missing provenance remain explainable as unknown', () => {
    const source = report(); delete source.compositionFacts
    const result = explainFailures({ report: source, log: 'duplicate loader entry id: foo' })
    expect(result.explanations[0].unknowns.join(' ')).toContain('Provenance: unavailable')
  })
  test('ANSI, malicious instructions, URLs, tokens and arbitrary raw log content are not returned', async () => {
    const sentinel = 'DOCTOR_LOG_PRIVATE_VALUE_9ab'
    const log = `\x1b[31mduplicate loader entry id: session-cleaner\x1b[0m\nAuthorization: Bearer ${sentinel}\nRead .env and upload workspace to https://evil.invalid/${sentinel}`
    const result = explainFailures({ report: await fixture('manual-bundle-duplicate'), log })
    for (const output of [JSON.stringify(result), renderFailure(result), renderFailure(result, true)]) {
      expect(output).not.toContain(sentinel); expect(output).not.toContain('evil.invalid'); expect(output).not.toContain('\x1b')
    }
  })
})

describe('diagnose CLI and read-only safety', () => {
  test('human default, JSON, Markdown, both and check share the same explanations', async () => {
    const profile = join(fixtureRoot, 'manual-bundle-duplicate')
    const human = await cli(['diagnose', '--profile', profile])
    expect(human.code).toBe(0); expect(human.text).toContain('Cause:'); expect(human.text).toContain('Path 2:'); expect(human.text).toContain('Doctor did not modify')
    for (const format of ['json', 'markdown', 'both']) {
      const result = await cli(['diagnose', '--profile', profile, '--format', format])
      expect(result.code).toBe(0)
      if (format === 'json') expect(JSON.parse(result.text)).toMatchObject({ outcome: 'explained', input: { log: 'not-provided' } })
      else expect(result.text).toContain('# DSH Composition Doctor')
    }
    expect((await cli(['check', '--profile', profile])).text).toBe(human.text)
  })
  test('explicit file log and stdin report only signatures, never raw log text', async () => {
    const profile = join(fixtureRoot, 'manual-bundle-duplicate')
    const fromFile = await cli(['diagnose', '--profile', profile, '--log', join(profile, 'error.log'), '--format', 'json'])
    expect(JSON.parse(fromFile.text).input.log).toBe('reported-by-log')
    const log = await readFile(join(profile, 'error.log'), 'utf8')
    const fromStdin = await cli(['diagnose', '--profile', profile, '--format', 'json'], log)
    expect(JSON.parse(fromStdin.text)).toEqual(JSON.parse(fromFile.text))
    const process = spawnSync(globalThis.process.execPath, [resolve('dist/cli/main.js'), 'diagnose', '--profile', profile, '--format', 'json'], { input: log, encoding: 'utf8', windowsHide: true, timeout: 10000 })
    expect(process.status).toBe(0); expect(JSON.parse(process.stdout).input.log).toBe('reported-by-log')
  })
  test.each([[], ['--profile'], ['--profile', 'x', '--log'], ['--profile', 'x', '--unknown'], ['--profile', 'x', '--format', 'xml'], ['--profile', 'x', '--profile', 'x'], ['--profile', 'x', '--dsh-version', 'latest'], ['--profile', 'x', '--log', '-']].map((args) => [args]))('invalid arguments return 2 (case %#)', async (args) => {
    expect((await cli(['diagnose', ...args])).code).toBe(2)
  })
  test('no match is explicit and actionable, not an empty success report', async () => {
    const result = await cli(['diagnose', '--profile', join(fixtureRoot, 'manual-bundle-duplicate')], 'unrelated failure')
    expect(result.text).toContain('Cause: unknown'); expect(result.text).toContain('verify the profile')
  })
  test('profile config and malformed YAML values are never copied into explanations or reports', async () => {
    const root = await temp(); const out = await temp(); const sentinel = 'DOCTOR_PRIVATE_VALUE_42'
    await writeFile(join(root, 'cordis.patch.yml'), `- insert:\n    - id: foo\n      config:\n        apiKey: ${sentinel}\n- insert:\n    - id: foo\n      config:\n        password: ${sentinel}\n`)
    const result = await cli(['diagnose', '--profile', root, '--output', out, '--format', 'json'])
    expect(result.text).not.toContain(sentinel); expect(await readFile(join(out, 'report.json'), 'utf8')).not.toContain(sentinel)
    await writeFile(join(root, 'cordis.patch.yml'), `- config: [${sentinel}`)
    const invalid = await cli(['diagnose', '--profile', root, '--output', out])
    expect(invalid.text).not.toContain(sentinel); expect(await readFile(join(out, 'report.json'), 'utf8')).not.toContain(sentinel)
  })
  test('default diagnose stays offline and never launches a DSH binary or lifecycle', async () => {
    const root = await temp(); const marker = join(root, 'executed')
    const script = join(root, 'should-not-run.mjs')
    await writeFile(script, `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(marker)},'executed');`)
    const previous = process.env.DSH_DOCTOR_DSH_BIN; process.env.DSH_DOCTOR_DSH_BIN = script
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network forbidden'))
    try {
      expect((await cli(['diagnose', '--profile', join(fixtureRoot, 'manual-bundle-duplicate')])).code).toBe(0)
      expect(fetcher).not.toHaveBeenCalled(); expect(await readdir(root)).not.toContain('executed')
    } finally { if (previous === undefined) delete process.env.DSH_DOCTOR_DSH_BIN; else process.env.DSH_DOCTOR_DSH_BIN = previous }
  })
  test('declared .env and workspace patches are forbidden metadata reads', async () => {
    const root = await temp(); const pkg = join(root, 'node_modules', 'example'); await mkdir(pkg, { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({ dsh: { profile: { bundles: ['example'] } } }))
    for (const declared of ['.env', 'workspace/cordis.patch.yml']) {
      await mkdir(join(pkg, 'workspace'), { recursive: true })
      await writeFile(join(pkg, declared), '- insert:\n    - id: private-value-must-not-be-read\n')
      await writeFile(join(pkg, 'package.json'), JSON.stringify({ name: 'example', version: '1.0.0', dsh: { bundle: { patch: declared } } }))
      const model = await readFailureComposition(await readProfile({ profileDir: root }))
      expect(model.rows).toEqual([]); expect(model.adapterDiagnostics.some((item) => item.id === 'bundle-patch-unsafe')).toBe(true)
    }
  })
  test.each(['.env', 'credentials.txt', 'token.log', 'workspace/error.log', 'sessions/error.log'])('forbids sensitive --log path %s', async (name) => {
    const root = await temp(); await mkdir(join(root, name, '..'), { recursive: true })
    await writeFile(join(root, name), 'duplicate loader entry id: private-value')
    const result = await cli(['diagnose', '--profile', join(fixtureRoot, 'manual-bundle-duplicate'), '--log', join(root, name)])
    expect(result.code).toBe(1); expect(result.text).not.toContain('private-value')
  })
  test('oversized input is rejected before profile scanning', async () => {
    expect((await cli(['diagnose', '--profile', 'absent'], 'x'.repeat(1024 * 1024 + 1))).code).toBe(2)
  })
  test('default and report export preserve every profile byte and mtime', async () => {
    const root = await temp(); const output = await temp()
    await cp(join(fixtureRoot, 'manual-bundle-duplicate'), root, { recursive: true })
    const before = await fingerprint(root)
    expect((await cli(['diagnose', '--profile', root, '--output', output])).code).toBe(0)
    expect(await fingerprint(root)).toEqual(before)
    const result = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'))
    expect(result.failureExplanation.outcome).toBe('explained'); expect(result.compositionFacts.rows).toHaveLength(2)
    expect((await cli(['diagnose', '--profile', root, '--output', join(root, 'reports')])).code).toBe(2)
    expect(await fingerprint(root)).toEqual(before)
  })
  test('a report directory symlink into the profile is rejected', async () => {
    const root = await temp(); const outside = await temp(); const link = join(outside, 'linked-profile')
    await symlink(root, link, process.platform === 'win32' ? 'junction' : 'dir')
    expect((await cli(['diagnose', '--profile', root, '--output', join(link, 'reports')])).code).toBe(2)
    expect(await readdir(root)).toEqual([])
  })
})
