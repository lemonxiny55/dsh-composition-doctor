// A 25-second recording, using minimized public regressions and the built CLI.
// No profile changes, package operations, DSH runtime or network access.
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fast = process.argv.includes('--fast')
const pause = (ms) => fast ? Promise.resolve() : new Promise((done) => setTimeout(done, ms))
for (const [name, title] of [['manual-bundle-duplicate', 'Installed a bundle over a manual row?'], ['missing-patch', 'Installed package missing its YAML patch?']]) {
  const profile = resolve(root, 'test', 'fixtures', 'failures', name)
  const log = resolve(profile, 'error.log')
  console.log(`\n${title}\n\nDSH ERROR\n${(await readFile(log, 'utf8')).trim()}\n`)
  await pause(2500)
  console.log(`$ dsh-doctor diagnose --profile <profile> --log dsh-error.log\n`)
  console.log(execFileSync(process.execPath, [resolve(root, 'dist', 'cli', 'main.js'), 'diagnose', '--profile', profile, '--log', log], { cwd: root, windowsHide: true, encoding: 'utf8' }).trim())
  await pause(10000)
}
