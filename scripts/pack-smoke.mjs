import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const archive = resolve(process.argv[2] ?? 'dsh-composition-doctor-0.4.0.tgz')
const pnpm = process.env.npm_execpath
if (!pnpm || !/pnpm\.(?:cjs|js|mjs)$/i.test(pnpm)) throw new Error('Run with: pnpm smoke:pack <packed-tarball>')
const root = await mkdtemp(join(tmpdir(), 'doctor-fresh-install-'))
function run(args, options = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 120000, windowsHide: true, ...options })
  if (result.status !== 0) throw new Error(`Smoke command failed (${result.status}): ${result.stderr || result.stdout || result.error}`)
  return result.stdout
}
try {
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'doctor-pack-smoke', private: true,
    dependencies: { 'dsh-composition-doctor': `file:${archive.replaceAll('\\', '/')}` } }))
  // This is release verification tooling, not Doctor's default/offline operation.
  // Registry resolution is allowed here; install lifecycle scripts stay disabled.
  run([pnpm, 'install', '--ignore-scripts', '--config.manage-package-manager-versions=false', '--store-dir', join(root, 'store')])
  const installed = join(root, 'node_modules', 'dsh-composition-doctor')
  const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'))
  assert.equal(manifest.version, '0.4.0')
  assert.equal(manifest.bin['dsh-doctor'], './dist/cli/main.js')
  assert.equal(manifest.scripts?.preinstall, undefined)
  assert.equal(manifest.scripts?.install, undefined)
  const main = join(installed, 'dist', 'cli', 'main.js')
  assert.equal(run([main, '--version']).trim(), '0.4.0')
  assert.match(run([main, '--help']), /diagnose \| check/)
  // Exercise the actual installed .bin launcher on each platform, including Windows shims.
  const shim = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'dsh-doctor.cmd' : 'dsh-doctor')
  const launch = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `call "${shim}" --version`], { cwd: root, encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true })
    : spawnSync(shim, ['--version'], { cwd: root, encoding: 'utf8' })
  assert.equal(launch.status, 0, launch.stderr)
  assert.equal(launch.stdout.trim(), '0.4.0')
  const profile = join(root, 'profile')
  await mkdir(profile)
  await cp(join(repository, 'test', 'fixtures', 'failures', 'manual-bundle-duplicate'), profile, { recursive: true })
  const log = await readFile(join(profile, 'error.log'), 'utf8')
  const diagnosis = JSON.parse(run([main, 'diagnose', '--profile', profile, '--format', 'json'], { input: log }))
  assert.equal(diagnosis.outcome, 'explained')
  assert.equal(diagnosis.explanations[0].provenancePaths.length, 2)
  assert.equal(diagnosis.runtime, 'not-observed')
  assert.match(run([main, 'diagnose', '--profile', profile, '--log', join(profile, 'error.log')]), /Doctor did not modify your profile/)
  const noMatch = JSON.parse(run([main, 'diagnose', '--profile', profile, '--format', 'json'], { input: 'unrecognized failure' }))
  assert.equal(noMatch.outcome, 'no-match')
  const exported = join(root, 'reports')
  run([main, 'diagnose', '--profile', profile, '--report-dir', exported])
  const report = JSON.parse(await readFile(join(exported, 'report.json'), 'utf8'))
  assert.equal(report.failureExplanation.outcome, 'explained')
  const bundle = await readFile(join(installed, 'dist', 'client.js'), 'utf8')
  assert.match(bundle, /Failure Explanation/)
  assert.match(bundle, /window\.__ModuleLoader__\.load/)
  run(['--input-type=module', '-e', "const m=await import('dsh-composition-doctor');if(m.name!=='dsh-composition-doctor')throw Error('host export failed')"])
  console.log('PACK SMOKE PASS: fresh install, installed shim, stdin/file diagnose, no-match, report export, host export and browser bundle; lifecycle scripts disabled.')
} finally { await rm(root, { recursive: true, force: true }) }
