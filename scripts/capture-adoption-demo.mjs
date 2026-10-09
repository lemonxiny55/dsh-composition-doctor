// Capture actual CLI output from inert, checked-in public-pattern fixtures.
// Pass an installed 0.4.0 CLI path to demonstrate the published artifact.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = resolve(root, process.argv[2] ?? 'dist/cli/main.js')
const out = resolve(root, 'docs/demo')
mkdirSync(out, { recursive: true })
const run = (args, input) => execFileSync(process.execPath, [cli, ...args], {
  cwd: root, windowsHide: true, encoding: 'utf8', input,
})
const version = run(['--version']).trim()
if (version !== '0.4.0') throw new Error(`Expected 0.4.0, got ${version}`)
const scenes = []
for (const name of ['manual-bundle-duplicate', 'missing-patch']) {
  const profile = `test/fixtures/failures/${name}`
  const log = `${profile}/error.log`
  const args = ['diagnose', '--profile', profile, '--log', log]
  const stdout = run(args)
  const json = JSON.parse(run([...args, '--format', 'json']))
  writeFileSync(resolve(out, `${name}.txt`), `${stdout.trimEnd()}\n`)
  writeFileSync(resolve(out, `${name}.json`), `${JSON.stringify(json, null, 2)}\n`)
  writeFileSync(resolve(out, `${name}.md`), `${run([...args, '--format', 'markdown']).trimEnd()}\n`)
  scenes.push({ name, log: readFileSync(resolve(root, log), 'utf8').trim(), stdout,
    command: '$ dsh-doctor diagnose --profile <profile-dir> --log <minimal-error.log>',
    exitCode: 0, stdoutSHA256: createHash('sha256').update(stdout).digest('hex') })
}
const negative = run(['diagnose', '--profile', 'test/fixtures/healthy-single-plugin', '--log', '-'],
  'Error: desktop welcome: Web RPC failed\n')
if (!negative.includes('No supported failure signature matched')) throw new Error('Negative control changed')
writeFileSync(resolve(out, 'unsupported-rpc.txt'), `${negative.trimEnd()}\n`)
const capture = { capturedAt: new Date().toISOString(), version, node: process.version,
  platform: process.platform, cliSHA256: createHash('sha256').update(readFileSync(cli)).digest('hex'),
  kind: 'Rendered actual CLI output; minimized public-pattern fixtures; no DSH runtime replay',
  scenes, negativeControl: negative }
writeFileSync(resolve(out, 'adoption-capture.json'), `${JSON.stringify(capture, null, 2)}\n`)
console.log(JSON.stringify({ version, scenes: scenes.map(s => ({name:s.name, exitCode:s.exitCode})), negativeControl:negative.trim() }, null, 2))
