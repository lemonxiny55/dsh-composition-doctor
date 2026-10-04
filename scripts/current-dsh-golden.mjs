// Maintainer-only capture of the public composition command. No plugin runtime
// is imported. Review the normalized structural output before tracking a golden.
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const binary = process.argv[2]
if (!binary) throw new Error('Usage: node scripts/current-dsh-golden.mjs <official-bin.js>')
const root = await mkdtemp(join(tmpdir(), 'doctor-current-golden-'))
const home = join(root, 'home'), profile = join(home, 'profiles', 'compat')
try {
  const fixture = resolve('test/fixtures/real-dsh')
  await mkdir(join(profile, 'node_modules', 'dsh-doctor-real-bundle'), { recursive: true })
  await cp(join(fixture, 'profile'), profile, { recursive: true })
  await cp(join(fixture, 'bundle'), join(profile, 'node_modules', 'dsh-doctor-real-bundle'), { recursive: true })
  await cp(join(fixture, 'home.patch.yml'), join(home, 'cordis.patch.yml'))
  const overlay = join(root, 'overlay.patch.yml'); await cp(join(fixture, 'overlay.patch.yml'), overlay)
  const env = { PATH: process.env.PATH, TEMP: process.env.TEMP, TMP: process.env.TMP, DSH_HOME: home }
  const version = execFileSync(process.execPath, [resolve(binary), '--version'], { env, windowsHide: true, encoding: 'utf8' }).trim()
  if (version !== '0.2.0-rc.2') throw new Error('Unexpected artifact version')
  const output = execFileSync(process.execPath, [resolve(binary), '--profile', 'compat', '--patch', overlay, '--dump-config'], { cwd: root, env, windowsHide: true, encoding: 'utf8' })
  const normalized = output.replaceAll(join(profile, 'cordis.patch.yml'), '<PROFILE_PATCH>').replaceAll(join(home, 'cordis.patch.yml'), '<HOME_PATCH>').replaceAll(overlay, '<CLI_PATCH>')
  // Guard known structural-only golden shape: no environment/config secret values.
  const previous = await readFile(join(fixture, '0.1.5-rc.2.dump.yml'), 'utf8')
  console.log(`DSH ${version}; previous structural golden ${normalized === previous ? 'identical' : 'changed, review required'}`)
  console.log(normalized)
  await writeFile(join(fixture, '0.2.0-rc.2.dump.yml'), normalized)
} finally { await rm(root, { recursive: true, force: true }) }
