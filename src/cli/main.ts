import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { resolveComposition } from '../core/composition-adapter.js'
import { diffSnapshots, renderSnapshotDiffMarkdown } from '../core/diff.js'
import { readProfile } from '../core/profile-reader.js'
import { createSnapshot, type Snapshot } from '../core/snapshot.js'
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
  const report = analyseComposition(await resolveComposition(await readProfile({ profileDir: resolve(profile) })))
  const destination = resolve(output)
  const destinations = [destination, ...(publish ? [resolveReportDirectory(configuredReportDir)] : [])]
  for (const directory of destinations) {
    await mkdir(directory, { recursive: true })
    if (format === 'json' || format === 'both') await writeFile(resolve(directory, 'report.json'), renderJson(report), 'utf8')
    if (format === 'markdown' || format === 'both') await writeFile(resolve(directory, 'report.md'), renderMarkdown(report), 'utf8')
  }
  io.write(`Wrote reports to ${destination}`)
  if (publish) io.write(`Published reports to ${destinations[1]}`)
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

function isSnapshot(value: unknown): value is Snapshot {
  return value !== null && typeof value === 'object' && (value as { schemaVersion?: unknown }).schemaVersion === 1
}

async function diff(argv: readonly string[], io: CliIo): Promise<number> {
  const beforePath = option(argv, '--before')
  const afterPath = option(argv, '--after')
  const format = option(argv, '--format') ?? 'json'
  if (beforePath === undefined || afterPath === undefined) return invalid(io, 'diff requires --before and --after')
  if (format !== 'json' && format !== 'markdown' && format !== 'both') return invalid(io, '--format must be json, markdown, or both')
  const before: unknown = JSON.parse(await readFile(resolve(beforePath), 'utf8'))
  const after: unknown = JSON.parse(await readFile(resolve(afterPath), 'utf8'))
  if (!isSnapshot(before) || !isSnapshot(after)) return invalid(io, 'diff inputs must be schema version 1 snapshots')
  const result = diffSnapshots(before, after)
  if (format === 'json' || format === 'both') io.write(`${JSON.stringify(result, null, 2)}\n`)
  if (format === 'markdown' || format === 'both') io.write(renderSnapshotDiffMarkdown(result))
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
    keepTemp: argv.includes('--keep-temp')
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode
  })
}
