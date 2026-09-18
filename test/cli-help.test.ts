import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { runCli, type CliIo } from '../src/cli/main.js'

function captureOutput(): { io: CliIo; lines: string[] } {
  const lines: string[] = []
  return {
    io: { write: (line) => lines.push(line) },
    lines
  }
}

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('runCli', () => {
  it.each<[string[]]>([[[]], [['--help']]])('shows all commands for %j', async (argv) => {
    const output = captureOutput()

    await expect(runCli(argv, output.io)).resolves.toBe(0)
    expect(output.lines).toEqual([
      'Usage: dsh-doctor <scan | snapshot | diff | preflight>'
    ])
  })

  it('prints the published package version', async () => {
    const output = captureOutput()

    await expect(runCli(['--version'], output.io)).resolves.toBe(0)
    expect(output.lines).toEqual(['0.2.2'])
  })

  it('rejects an unrecognised command', async () => {
    const output = captureOutput()

    await expect(runCli(['unknown'], output.io)).resolves.toBe(2)
    expect(output.lines).toEqual(['Unknown command: unknown'])
  })

  it('writes scan reports only to its explicit output directory', async () => {
    const output = captureOutput()
    const directory = await mkdtemp(join(tmpdir(), 'dsh-doctor-cli-'))
    temporaryDirectories.push(directory)

    await expect(runCli(['scan', '--profile', resolve('test/fixtures/healthy'), '--format', 'both', '--output', directory], output.io)).resolves.toBe(0)
    await expect(readFile(join(directory, 'report.json'), 'utf8')).resolves.toContain('runtime-composition-unavailable')
    await expect(readFile(join(directory, 'report.md'), 'utf8')).resolves.toContain('DSH Composition Doctor Report')
    expect(output.lines).toEqual([`Wrote reports to ${resolve(directory)}`])
  })
})
