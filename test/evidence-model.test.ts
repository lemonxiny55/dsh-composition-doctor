import { describe, expect, test, vi } from 'vitest'

vi.mock('react', () => ({
  createElement: () => ({}),
  useEffect: () => undefined,
  useRef: <T>(initial: T) => ({ current: initial })
}))

import { resolveComposition } from '../src/core/composition-adapter.js'
import { readProfile } from '../src/core/profile-reader.js'
import { analyseComposition } from '../src/core/rules.js'
import { analysisReportJsonSchema } from '../src/reports/schema.js'
import { evidenceBadgeLabel } from '../src/client/report-view.js'

describe('evidence capability model', () => {
  test('static analysis is explicitly static and does not imply runtime observation', async () => {
    const input = await readProfile({ profileDir: 'test/fixtures/healthy' })
    const report = analyseComposition(await resolveComposition(input))

    expect(report).toMatchObject({ evidenceSchemaVersion: 2, evidenceMode: 'static', runtimeObserved: false })
    expect(report.diagnostics.flatMap((item) => item.evidence).every((item) => item.evidenceKind === 'static')).toBe(true)
  })

  test('a public dump/provider result is composed, never runtime-observed', async () => {
    const input = await readProfile({ profileDir: 'test/fixtures/healthy' })
    const composition = await resolveComposition(input, {
      resolve: async () => [{ id: 'provider-row', source: 'public-provider', evidenceKind: 'static' as const }]
    })
    const report = analyseComposition(composition)

    expect(report.evidenceMode).toBe('composed')
    expect(report.runtimeObserved).toBe(false)
    expect(composition.rows[0]?.evidenceKind).toBe('composed')
  })

  test('runtime-observed is downgraded unless an observation backend actually reports success', () => {
    const report = analyseComposition({
      profileDir: 'fixture',
      rows: [],
      adapterDiagnostics: [],
      evidenceMode: 'runtime-observed'
    })

    expect(report.evidenceMode).toBe('composed')
    expect(report.runtimeObserved).toBe(false)
    expect(report.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'runtime-observation-unavailable', severity: 'warning' })
    ]))
  })

  test('the additive report schema distinguishes composed from legacy resolved', () => {
    expect(analysisReportJsonSchema.required).toContain('evidenceSchemaVersion')
    expect(analysisReportJsonSchema.properties.evidenceMode.enum).toEqual(['static', 'composed', 'runtime-observed', 'mixed'])
    expect(analysisReportJsonSchema.properties.runtimeObserved.type).toBe('boolean')
    expect(analysisReportJsonSchema.properties.diagnostics.items.properties.evidence.items.properties.evidenceKind.enum)
      .toEqual(['static', 'composed', 'runtime-observed'])
    expect(analysisReportJsonSchema.required).not.toContain('compositionFacts')
    expect(analysisReportJsonSchema.properties.compositionFacts.properties.schemaVersion.const).toBe(1)
  })

  test('web badge does not label dump-config as runtime verified', () => {
    expect(evidenceBadgeLabel('composed', false)).toBe('composed; runtime not observed')
    expect(evidenceBadgeLabel('runtime-observed', false)).toBe('composed; runtime not observed')
    expect(evidenceBadgeLabel('runtime-observed', true)).toBe('runtime-observed')
  })
})
