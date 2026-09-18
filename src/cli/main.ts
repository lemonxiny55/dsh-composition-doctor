import { fileURLToPath } from 'node:url'
import { readFileSync, realpathSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { resolveComposition } from '../core/composition-adapter.js'
import { diffSnapshots, renderSnapshotDiffMarkdown } from '../core/diff.js'
import { readProfile } from '../core/profile-reader.js'
import { createSnapshot, isSnapshotV1, isSnapshotV2, type Snapshot } from '../core/snapshot.js'
import { analyseComposition } from '../core/rules.js'
import { renderJson } from '../reports/json.js'
import { renderMarkdown } from '../reports/markdown.js'
import { resolveReportDirectory } from '../reports/location.js'
import { runPreflight } from '../core/preflight.js'

export interface CliIo {
  write(line: string): void
}

const usage = 'Usage: dsh-doctor <scan | snapshot | diff | preflight>'
const commands = new Set(['scan', 'snapshot', 'diff', 'preflight'])

function packageVersion(): string {
  try {
    const manifest = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8')) as { version?: unknown }
    return typeof manifest.version === 'string' ? manifest.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name)
  return index >= 0 && typeof argv[index + 1] === 'string' ? argv[index + 1] : undefined
}

function options(argv: readonly string[], name: string): string[] {
  const values: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === name && typeof argv[index + 1] === 'string') values.push(argv[index + 1])
  }
  return values
}

function invalid(io: CliIo, message: string): number {
  io.write(`Invalid command: ${message}`)
  return 2
}

async function scan(argv: readonly string[], io: CliIo): Promise<number> {
  const profile = option(argv, '--profile')
  const output = option(argv, '--output')
  const configuredReportDir = option(argv, '--report-dir')
  const publish = argv.includes('--publish') || configuredReportDir !== undefined
  const format = option(argv, '--format') ?? 'json'
  if (profile === undefined || output === undefined) return invalid(io, 'scan requires --profile and --output')
  if (format !== 'json' && format !== 'markdown' && format !== 'both') return invalid(io, '--format must be json, markdown, or both')
  const failOn = option(argv, '--fail-on') ?? 'never'
  if (failOn !== 'never' && failOn !== 'info' && failOn !== 'warning' && failOn !== 'error') return invalid(io, '--fail-on must be info, warning, error, or never')
  const primary = await resolveComposition(await readProfile({ profileDir: resolve(profile) }))
  const compared = await Promise.all(options(argv, '--compare-profile').map(async (value) => ({ name: value, model: await resolveComposition(await readProfile({ profileDir: resolve(value) })) })))
  const report = analyseComposition(compared.length === 0 ? primary : {
    ...primary,
    bundles: [...(primary.bundles ?? []), ...compared.flatMap(({ name, model }) => (model.bundles ?? []).map((bundle) => ({ ...bundle, profile: name })))],
    adapterDiagnostics: [...primary.adapterDiagnostics, ...compared.flatMap(({ model }) => model.adapterDiagnostics)]
  })
  const destination = resolve(output)
  const destinations = [destination, ...(publish ? [resolveReportDirectory(configuredReportDir)] : [])]
  for (const directory of destinations) {
    await mkdir(directory, { recursive: true })
    if (format === 'json' || format === 'both') await writeFile(resolve(directory, 'report.json'), renderJson(report), 'utf8')
    if (format === 'markdown' || format === 'both') await writeFile(resolve(directory, 'report.md'), renderMarkdown(report), 'utf8')
  }
  io.write(`Wrote reports to ${destination}`)
  if (publish) io.write(`Published reports to ${destinations[1]}`)
  if (failOn === 'info' && report.diagnostics.length > 0) return 1
  if (failOn === 'error' && report.diagnostics.some((item) => item.severity === 'error')) return 1
  if (failOn === 'warning' && report.diagnostics.some((item) => item.severity === 'warning' || item.severity === 'error')) return 1
  return 0
}

async function snapshot(argv: readonly string[], io: CliIo): Promise<number> {
  const profile = option(argv, '--profile')
  const output = option(argv, '--output')
  if (profile === undefined || output === undefined) return invalid(io, 'snapshot requires --profile and --output')
  const destination = resolve(output)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, `${JSON.stringify(await createSnapshot(await readProfile({ profileDir: resolve(profile) })), null, 2)}\n`, 'utf8')
  io.write(`Wrote snapshot to ${destination}`)
  return 0
}

function isSnapshot(value: unknown): value is Snapshot { return isSnapshotV1(value) || isSnapshotV2(value) }

async function diff(argv: readonly string[], io: CliIo): Promise<number> {
  const beforePath = option(argv, '--before')
  const afterPath = option(argv, '--after')
  const format = option(argv, '--format') ?? 'json'
  if (beforePath === undefined || afterPath === undefined) return invalid(io, 'diff requires --before and --after')
  if (format !== 'json' && format !== 'markdown' && format !== 'both') return invalid(io, '--format must be json, markdown, or both')
  const before: unknown = JSON.parse(await readFile(resolve(beforePath), 'utf8'))
  const after: unknown = JSON.parse(await readFile(resolve(afterPath), 'utf8'))
  if (!isSnapshot(before) || !isSnapshot(after)) return invalid(io, 'diff inputs must be schema version 1 or 2 snapshots')
  const result = diffSnapshots(before, after)
  const output = option(argv, '--output')
  const rendered = [
    ...(format === 'json' || format === 'both' ? [`${JSON.stringify(result, null, 2)}\n`] : []),
    ...(format === 'markdown' || format === 'both' ? [renderSnapshotDiffMarkdown(result)] : [])
  ]
  if (output === undefined) rendered.forEach((value) => io.write(value))
  else {
    const destination = resolve(output)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, rendered.join(''), 'utf8')
    io.write(`Wrote diff to ${destination}`)
  }
  return 0
}

async function preflight(argv: readonly string[], io: CliIo): Promise<number> {
  const profile = option(argv, '--profile')
  const targetDsh = option(argv, '--target-dsh')
  const output = option(argv, '--output')
  if (profile === undefined || targetDsh === undefined) return invalid(io, 'preflight requires --profile and --target-dsh')
  const result = await runPreflight({
    profileDir: resolve(profile),
    targetDsh,
    candidates: options(argv, '--candidate'),
    allowBuild: argv.includes('--allow-build'),
    online: argv.includes('--online'),
    keepTemp: argv.includes('--keep-temp'),
    dshBin: option(argv, '--dsh-bin'),
    dshPackage: option(argv, '--dsh-package'),
    packageManagerCacheDirs: options(argv, '--package-manager-cache')
  })
  const rendered = `${JSON.stringify(result, null, 2)}\n`
  if (output === undefined) io.write(rendered)
  else {
    const destination = resolve(output)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, rendered, 'utf8')
    io.write(`Wrote preflight report to ${destination}`)
  }
  return result.outcome === 'fail' ? 1 : 0
}

export async function runCli(argv: readonly string[], io: CliIo = { write: (line) => console.log(line) }): Promise<number> {
  const command = argv[0]

  if (argv.length === 0 || command === '--help') {
    io.write(usage)
    return 0
  }

  if (command === '--version') {
    io.write(packageVersion())
    return 0
  }

  if (!commands.has(command)) {
    io.write(`Unknown command: ${command}`)
    return 2
  }

  try {
    if (command === 'scan') return await scan(argv.slice(1), io)
    if (command === 'snapshot') return await snapshot(argv.slice(1), io)
    if (command === 'diff') return await diff(argv.slice(1), io)
    return await preflight(argv.slice(1), io)
  } catch (error: unknown) {
    io.write(error instanceof Error ? error.message : String(error))
    return 1
  }
}

function canonicalPath(value: string): string {
  try {
    return realpathSync(value)
  } catch {
    return resolve(value)
  }
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1]
  if (entrypoint === undefined) return false
  const modulePath = canonicalPath(fileURLToPath(import.meta.url))
  const entrypointPath = canonicalPath(entrypoint)
  return process.platform === 'win32'
    ? modulePath.toLowerCase() === entrypointPath.toLowerCase()
    : modulePath === entrypointPath
}

if (isMainModule()) {
  runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode
  })
}
