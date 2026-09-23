import { describe, expect, test } from 'vitest'
import { resolve } from 'node:path'

import { runCli, type CliIo } from '../src/cli/main.js'

function capture(): { io: CliIo; output: string[] } {
  const output: string[] = []
  return { io: { write: (line) => output.push(line) }, output }
}

describe('why and impact CLI', () => {
  test('why row explains a static row and labels runtime information unknown', async () => {
    const captured = capture()
    await expect(runCli(['why', 'row', 'healthy-plugin', '--profile', resolve('test/fixtures/healthy')], captured.io)).resolves.toBe(0)
    const result = JSON.parse(captured.output[0]!) as Record<string, any>
    expect(result).toMatchObject({ outcome: 'found', query: { entity: 'row', id: 'healthy-plugin' }, evidenceMode: 'static' })
    expect(result.row.effectiveObservedStructure.configKeys).toEqual(['enabled'])
    expect(result.row.replacement).toEqual({ state: 'unknown', basis: 'unknown' })
    expect(result.unknown.join(' ')).toContain('final composed row is unknown')
    expect(result.unknown.join(' ')).toContain('runtime behavior was not observed')
  })

  test('why row returns a clear not-found result', async () => {
    const captured = capture()
    await expect(runCli(['why', 'row', 'absent-row', '--profile', resolve('test/fixtures/healthy')], captured.io)).resolves.toBe(0)
    expect(JSON.parse(captured.output[0]!)).toMatchObject({ outcome: 'not-found', query: { id: 'absent-row' } })
  })

  test('why row explains a composed row and its observable patch chain', async () => {
    const captured = capture()
    const previous = process.env.DSH_DOCTOR_DSH_BIN
    process.env.DSH_DOCTOR_DSH_BIN = resolve('test/fixtures/fake-dsh-explain/dsh.mjs')
    try {
      await expect(runCli(['why', 'row', 'shared-row', '--profile', resolve('test/fixtures/healthy-single-plugin')], captured.io)).resolves.toBe(0)
    } finally {
      if (previous === undefined) delete process.env.DSH_DOCTOR_DSH_BIN
      else process.env.DSH_DOCTOR_DSH_BIN = previous
    }
    const result = JSON.parse(captured.output[0]!) as Record<string, any>
    expect(result).toMatchObject({ outcome: 'found', evidenceMode: 'composed', row: { replacement: { state: 'unknown', basis: 'unknown' } } })
    expect(result.row.provenance).toEqual([
      expect.objectContaining({ source: 'profile-layer', relation: 'introduced', sourceBasis: 'observed' }),
      expect.objectContaining({ source: '@fixture/healthy-bundle', relation: 'patched-by', sourceBasis: 'observed' })
    ])
    expect(result.row.package).toMatchObject({ name: '@fixture/healthy-bundle', version: '1.2.3' })
    expect(result.unknown.join(' ')).toContain('source chain indicates patching, but whole-row/config replacement, removed keys, and field owners are unknown')
  })

  test('impact bundle distinguishes an installed bundle with no observable rows', async () => {
    const captured = capture()
    await expect(runCli(['impact', 'bundle', '@fixture/healthy-bundle', '--profile', resolve('test/fixtures/healthy-single-plugin')], captured.io)).resolves.toBe(0)
    const result = JSON.parse(captured.output[0]!) as Record<string, any>
    expect(result).toMatchObject({ bundle: '@fixture/healthy-bundle', observed: true, outcome: 'no-observable-rows', rows: [] })
    expect(result.unknown).toContain('possible dependents: not modelled')
  })

  test('impact bundle lists only rows tied to its exact observed source label', async () => {
    const captured = capture()
    const previous = process.env.DSH_DOCTOR_DSH_BIN
    process.env.DSH_DOCTOR_DSH_BIN = resolve('test/fixtures/fake-dsh-explain/dsh.mjs')
    try {
      await expect(runCli(['impact', 'bundle', '@fixture/healthy-bundle', '--profile', resolve('test/fixtures/healthy-single-plugin')], captured.io)).resolves.toBe(0)
    } finally {
      if (previous === undefined) delete process.env.DSH_DOCTOR_DSH_BIN
      else process.env.DSH_DOCTOR_DSH_BIN = previous
    }
    const result = JSON.parse(captured.output[0]!) as Record<string, any>
    expect(result).toMatchObject({ outcome: 'observed-contributions', observed: true, rows: [expect.objectContaining({ id: 'shared-row' })] })
    expect(result.overrides).toEqual([])
    expect(result.patchContributions.map((row: { id: string }) => row.id)).toEqual(['shared-row'])
    expect(result.edges).toEqual(expect.arrayContaining([expect.objectContaining({ relation: 'patched-by' })]))
  })

  test('requires explicit profile paths for explain queries', async () => {
    const captured = capture()
    await expect(runCli(['why', 'row', 'healthy-plugin'], captured.io)).resolves.toBe(2)
    expect(captured.output[0]).toContain('--profile')
  })
})
