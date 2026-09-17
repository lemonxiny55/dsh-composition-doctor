import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { runCli, type CliIo } from '../src/cli/main.js'
import { Config, apply, latestReportPath } from '../src/plugin/index.js'

const temporaryDirectories: string[] = []

function io(): { lines: string[]; value: CliIo } {
  const lines: string[] = []
  return { lines, value: { write: (line) => lines.push(line) } }
}

async function routeFor(reportDir: string): Promise<{ handler: Function }> {
  return new Promise((resolveRoute) => {
    apply({ webServer: { register: (route) => { resolveRoute(route); return undefined } } }, { reportDir })
  })
}

async function responseFor(route: { handler: Function }): Promise<{ statusCode: number; body: string }> {
  let body = ''
  const response = { statusCode: 0, setHeader: vi.fn(), end: (value?: string) => { body = value ?? '' } }
  await route.handler({ method: 'GET' }, response)
  return { statusCode: response.statusCode, body }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('published report contract', () => {
  test('publishes an explicit CLI scan into the plugin report directory that the route reads', async () => {
    const output = await mkdtemp(join(tmpdir(), 'dsh-doctor-output-'))
    const reportDir = await mkdtemp(join(tmpdir(), 'dsh-doctor-published-'))
    temporaryDirectories.push(output, reportDir)
    const captured = io()

    await expect(runCli(['scan', '--profile', resolve('test/fixtures/healthy'), '--format', 'both', '--output', output, '--report-dir', reportDir], captured.value)).resolves.toBe(0)
    await expect(readFile(join(output, 'report.json'), 'utf8')).resolves.toContain('schemaVersion')
    const response = await responseFor(await routeFor(reportDir))

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toMatchObject({ schemaVersion: 1 })
  })

  test('returns a sanitized 404 for a missing or malformed report', async () => {
    const reportDir = await mkdtemp(join(tmpdir(), 'dsh-doctor-route-'))
    temporaryDirectories.push(reportDir)
    const route = await routeFor(reportDir)

    expect(await responseFor(route)).toEqual({ statusCode: 404, body: '{"error":"latest_report_not_found"}\n' })
    await writeFile(join(reportDir, 'report.json'), '{ not valid JSON', 'utf8')
    const malformed = await responseFor(route)
    expect(malformed).toEqual({ statusCode: 404, body: '{"error":"latest_report_not_found"}\n' })
    expect(malformed.body).not.toContain(reportDir)
    await writeFile(join(reportDir, 'report.json'), JSON.stringify({ schemaVersion: 1, diagnostics: [] }), 'utf8')
    expect(await responseFor(route)).toEqual({ statusCode: 404, body: '{"error":"latest_report_not_found"}\n' })
  })

  test('makes the ScheMastery report directory field optional with a default', () => {
    expect(Config({})).toEqual({ reportDir: '.dsh-composition-doctor/reports' })
    expect(Config({ reportDir: 'safe/reports' })).toEqual({ reportDir: 'safe/reports' })
  })

  test('keeps the report route read-only and stable', () => {
    expect(latestReportPath).toBe('/dsh-composition-doctor/reports/latest')
  })
})
