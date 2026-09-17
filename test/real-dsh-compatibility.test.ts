import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'

import { parseDshDump } from '../src/core/dsh-dump-parser.js'

const execFileAsync = promisify(execFile)
const fixtureRoot = resolve('test/fixtures/real-dsh')

interface FileState { sha256: string; mtimeMs: number; size: number }
type ProfileState = Record<string, FileState>

async function profileState(root: string): Promise<ProfileState> {
  const result: ProfileState = {}
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) {
        const bytes = await readFile(path)
        const metadata = await stat(path)
        result[path.slice(root.length + 1).replaceAll('\\', '/')] = { sha256: createHash('sha256').update(bytes).digest('hex'), mtimeMs: metadata.mtimeMs, size: metadata.size }
      }
    }
  }
  await visit(root)
  return result
}

interface RealRun { stdout: string; stderr: string; version: string; profile: string; home: string; overlay: string; missingOverlay: string }

async function runRealRelease(binary: string, extraPatch = false): Promise<RealRun> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-real-compat-'))
  const home = join(root, 'home')
  const profile = join(home, 'profiles', 'compat')
  const bundle = join(profile, 'node_modules', 'dsh-doctor-real-bundle')
  const overlay = join(root, 'overlay.patch.yml')
  const missingOverlay = join(root, 'missing.patch.yml')
  await mkdir(bundle, { recursive: true })
  await cp(join(fixtureRoot, 'profile'), profile, { recursive: true, force: true })
  await cp(join(fixtureRoot, 'bundle'), bundle, { recursive: true, force: true })
  await cp(join(fixtureRoot, 'home.patch.yml'), join(home, 'cordis.patch.yml'))
  await cp(join(fixtureRoot, 'overlay.patch.yml'), overlay)
  await cp(join(fixtureRoot, 'missing.patch.yml'), missingOverlay)

  const environment = { ...process.env, DSH_HOME: home }
  try {
    const versionResult = await execFileAsync(process.execPath, [binary, '--version'], { cwd: root, env: environment, windowsHide: true })
    const args = [binary, '--profile', 'compat', '--patch', overlay, ...(extraPatch ? ['--patch', missingOverlay] : []), '--dump-config']
    const dumpResult = await execFileAsync(process.execPath, args, { cwd: root, env: environment, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }) as unknown as { stdout: string; stderr: string }
    return { stdout: dumpResult.stdout, stderr: dumpResult.stderr, version: versionResult.stdout.trim(), profile, home, overlay, missingOverlay }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

function normalizeGolden(text: string, run: Pick<RealRun, 'profile' | 'home' | 'overlay' | 'missingOverlay'>): string {
  return text
    .replaceAll(join(run.profile, 'cordis.patch.yml'), '<PROFILE_PATCH>')
    .replaceAll(join(run.home, 'cordis.patch.yml'), '<HOME_PATCH>')
    .replaceAll(run.overlay, '<CLI_PATCH>')
    .replaceAll(run.missingOverlay, '<MISSING_PATCH>')
}

function binaryFromEnvironment(name: string): string | undefined {
  const value = process.env[name]
  return value === undefined || value.length === 0 ? undefined : resolve(value)
}

async function assertRelease(binary: string, release: string, goldenName: string): Promise<void> {
  const run = await runRealRelease(binary)
  expect(run.version).toBe(release)
  expect(run.stderr).toBe('')
  expect(normalizeGolden(run.stdout, run)).toBe(await readFile(join(fixtureRoot, goldenName), 'utf8'))

  const parsed = parseDshDump(run.stdout, run.stderr)
  expect(parsed.rows).toHaveLength(3)
  expect(parsed.rows.every((row) => row.evidenceKind === 'composed')).toBe(true)
  expect(parsed.rows.some((row) => row.evidenceKind === 'runtime-observed')).toBe(false)
  expect(parsed.rows.find((row) => row.id === 'shared-row')).toMatchObject({ replacement: true, configKeys: ['enabled', 'mode'] })
  const wholeConfig = parsed.rows.find((row) => row.id === 'whole-config')
  expect(wholeConfig?.configKeys).toEqual(['overlayOnly'])
  expect(wholeConfig?.config).not.toHaveProperty('bundleOnly')
  expect(wholeConfig?.config).not.toHaveProperty('profileOnly')
  expect(parsed.rows.find((row) => row.id === 'runtime-unknown')?.config).toMatchObject({ handler: "() => 'not executed'" })
  expect(parsed.rows.every((row) => row.provenance?.[0] === 'dsh-doctor-real-bundle')).toBe(true)
  expect(parsed.rows.find((row) => row.id === 'shared-row')?.provenance).toEqual([
    'dsh-doctor-real-bundle',
    expect.stringContaining('cordis.patch.yml'),
    expect.stringContaining('cordis.patch.yml'),
    expect.stringContaining('overlay.patch.yml')
  ])
  expect(run.stdout).toMatch(/C:\\Users\\/)
}

const rc1Binary = binaryFromEnvironment('DSH_DOCTOR_REAL_DSH_RC1_BIN')
const rc2Binary = binaryFromEnvironment('DSH_DOCTOR_REAL_DSH_RC2_BIN')

test.skipIf(rc1Binary === undefined)('real DSH 0.1.5-rc.1 public compatibility harness', async () => {
  await assertRelease(rc1Binary!, '0.1.5-rc.1', '0.1.5-rc.1.dump.yml')
})

test.skipIf(rc2Binary === undefined)('real DSH 0.1.5-rc.2 public compatibility harness', async () => {
  await assertRelease(rc2Binary!, '0.1.5-rc.2', '0.1.5-rc.2.dump.yml')
})

test.skipIf(rc2Binary === undefined)('real DSH stderr reports an unmatched patch without turning it into a fake PASS', async () => {
  const run = await runRealRelease(rc2Binary!, true)
  expect(run.stderr).toContain('missing-row')
  expect(parseDshDump(run.stdout, run.stderr).diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'unmatched-patch-target', evidence: expect.arrayContaining([expect.objectContaining({ evidenceKind: 'composed' })]) })]))
})

test.skipIf(rc1Binary === undefined)('real release execution does not mutate the checked-in profile fixture', async () => {
  const profile = join(fixtureRoot, 'profile')
  const before = await profileState(profile)
  await assertRelease(rc1Binary!, '0.1.5-rc.1', '0.1.5-rc.1.dump.yml')
  expect(await profileState(profile)).toEqual(before)
})

test('golden parser accepts provenance comments, Windows paths, and unevaluated !!js', async () => {
  const text = await readFile(join(fixtureRoot, '0.1.5-rc.2.dump.yml'), 'utf8')
  const parsed = parseDshDump(text)
  expect(parsed.rows).toHaveLength(3)
  expect(parsed.rows[0]?.provenance).toEqual(['dsh-doctor-real-bundle', '<PROFILE_PATCH>', '<HOME_PATCH>', '<CLI_PATCH>'])
  expect(parsed.rows[0]?.evidenceKind).toBe('composed')
  expect(parsed.rows[2]?.config).toMatchObject({ handler: "() => 'not executed'" })
})
