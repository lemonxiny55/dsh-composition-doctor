import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

import { redactYamlPreservingTags, redact } from './redaction.js'
import { parseDshDump } from './dsh-dump-parser.js'
import type { Diagnostic, ProfileInput } from './types.js'

const execFileAsync = promisify(execFile)
const yamlFiles = new Set(['cordis.yml', 'cordis.patch.yml'])

function unavailable(reason: string): Diagnostic {
  return {
    id: 'runtime-composition-unavailable', severity: 'warning', title: 'Resolved composition is unavailable', evidence: [{ source: '<DSH provider>', detail: reason, evidenceKind: 'static' }],
    explanation: 'The scan could not obtain final resolved rows from a public DSH dump-config provider, so it used bounded static evidence.',
    remediation: 'Install a verified DSH CLI or pass a public provider in integration code; do not import private DSH loaders.'
  }
}

function pathCandidates(): string[] {
  const values = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').filter(Boolean)
  return values.flatMap((directory) => process.platform === 'win32' ? [join(directory, 'dsh.cmd'), join(directory, 'dsh.exe'), join(directory, 'dsh')] : [join(directory, 'dsh')])
}

async function findDsh(): Promise<string | undefined> {
  const explicit = process.env.DSH_DOCTOR_DSH_BIN
  const candidates = explicit === undefined ? pathCandidates() : [explicit]
  for (const candidate of candidates) {
    try { if ((await stat(candidate)).isFile()) return candidate } catch { /* executable lookup is best effort */ }
  }
  return undefined
}

async function copyRehearsal(input: ProfileInput, directory: string): Promise<void> {
  for (const file of input.files) {
    if (file.relativePath === 'package.json') {
      await writeFile(join(directory, file.relativePath), `${JSON.stringify(redact(JSON.parse(file.text)), null, 2)}\n`, 'utf8')
    } else if (yamlFiles.has(file.relativePath)) {
      await writeFile(join(directory, file.relativePath), redactYamlPreservingTags(file.text), 'utf8')
    }
  }
}

function runtimeUnknownDiagnostic(input: ProfileInput): Diagnostic | undefined {
  const tagged = input.files.find((file) => yamlFiles.has(file.relativePath) && /!<[^>]+>|!![A-Za-z0-9_/-]+/.test(file.text))
  if (tagged === undefined) return undefined
  return {
    id: 'runtime-behavior-unverified', severity: 'warning', title: 'Runtime-dependent configuration remains unverified',
    evidence: [{ source: tagged.relativePath, detail: 'A custom YAML tag or runtime expression was preserved for dump-config but was not executed.', evidenceKind: 'composed' }],
    explanation: 'A composed configuration can be structurally resolved while runtime-dependent values remain unknown. dump-config is not a runtime observation.',
    remediation: 'Keep runtime-observed claims separate unless a supported isolated runtime observation backend is explicitly available.'
  }
}

export async function tryDshDump(input: ProfileInput, options: { dshBin?: string; timeoutMs?: number } = {}): Promise<{ rows: readonly import('./types.js').CompositionRow[]; diagnostics: readonly Diagnostic[] } | undefined> {
  const dshBin = options.dshBin ?? await findDsh()
  if (dshBin === undefined) return undefined
  const directory = await mkdtemp(join(tmpdir(), 'dsh-doctor-dump-'))
  try {
    const home = join(directory, 'dsh-home')
    const isolatedName = 'doctor-isolated'
    const profile = join(home, 'profiles', isolatedName)
    await mkdir(profile, { recursive: true })
    await copyRehearsal(input, profile)
    const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, TEMP: process.env.TEMP, TMP: process.env.TMP, DSH_HOME: home }
    const extension = extname(dshBin).toLowerCase()
    const script = ['.js', '.mjs', '.cjs'].includes(extension)
    const commandShim = process.platform === 'win32' && (extension === '.cmd' || extension === '.bat')
    const executable = script ? process.execPath : commandShim ? (process.env.ComSpec ?? 'cmd.exe') : dshBin
    const args = script ? [dshBin, '--profile', isolatedName, '--dump-config'] : commandShim ? ['/d', '/s', '/c', `call "${dshBin}" --profile ${isolatedName} --dump-config`] : ['--profile', isolatedName, '--dump-config']
    try {
      const result = await execFileAsync(executable, args, { cwd: directory, env, timeout: options.timeoutMs ?? 20_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }) as unknown as { stdout: string; stderr: string }
      const parsed = parseDshDump(result.stdout, result.stderr)
      const runtimeUnknown = runtimeUnknownDiagnostic(input)
      return { rows: parsed.rows, diagnostics: runtimeUnknown === undefined ? parsed.diagnostics : [...parsed.diagnostics, runtimeUnknown] }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error)
      // The caller must keep the static rows when the public command cannot
      // execute.  A default provider failure is represented by the bounded
      // static-fallback diagnostic in composition-adapter.
      void detail
      return undefined
    }
  } catch (error: unknown) {
    void error
    return undefined
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
