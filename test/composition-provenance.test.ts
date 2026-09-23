import { describe, expect, test } from 'vitest'

import { buildCompositionFacts, compositionBundleImpact } from '../src/core/composition-provenance.js'
import { analyseComposition } from '../src/core/rules.js'
import { renderJson } from '../src/reports/json.js'
import type { AnalysisReport, CompositionModel } from '../src/core/types.js'

function model(profileDir: string): CompositionModel {
  return {
    profileDir,
    evidenceMode: 'composed',
    runtimeObservation: { observed: false },
    rows: [{
      id: 'shared-row', name: 'Shared row', source: 'example-bundle', layer: 'profile', layerOrder: 3,
      provenance: ['example-bundle', 'cordis.patch.yml'], replacement: true, replacementBasis: 'derived',
      config: { apiKey: 'sensitive-value', enabled: true }, evidenceKind: 'composed'
    }],
    installedPackages: [{ name: 'example-bundle', installedVersion: '1.2.3', packageJsonSource: `${profileDir}/node_modules/example-bundle/package.json` }],
    adapterDiagnostics: [{ id: 'row-note', severity: 'info', title: 'Row note', evidence: [{ source: 'cordis.patch.yml', subject: 'shared-row', detail: 'Public dump provenance.', evidenceKind: 'composed' }], explanation: 'Observed row evidence.', remediation: 'None.' }]
  }
}

describe('composition provenance report facts', () => {
  test('builds deterministic, path-normalized and value-redacted facts', () => {
    const first = analyseComposition(model('C:/Users/alice/private-profile'))
    const second = analyseComposition(model('D:/profiles/other'))
    expect(first.compositionFacts).toEqual(second.compositionFacts)
    expect(JSON.stringify(first.compositionFacts)).toBe(JSON.stringify(second.compositionFacts))
    expect(first.profileDir).toBe('<PROFILE>')
    const serialized = renderJson(first)
    expect(serialized).not.toContain('C:/Users/alice')
    expect(serialized).not.toContain('sensitive-value')
    expect(first.compositionFacts?.rows[0]).toMatchObject({
      id: 'shared-row', source: 'example-bundle', layer: 'profile', layerOrder: 3,
      replacement: { state: 'unknown', basis: 'unknown' }, configKeys: ['apiKey', 'enabled'],
      packageName: 'example-bundle', packageVersion: '1.2.3', relatedDiagnosticIds: ['row-note']
    })
    expect(first.compositionFacts?.rows[0]?.unknown).toContain('source chain indicates patching, but whole-row/config replacement, removed keys, and field owners are unknown')
  })

  test('records provenance and patch relations without claiming per-field ownership', () => {
    const facts = buildCompositionFacts(model('C:/fixture'), [])
    expect(facts.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ relation: 'introduced', basis: 'derived', evidenceMode: 'composed' }),
      expect.objectContaining({ relation: 'patched-by', basis: 'derived', evidenceMode: 'composed' })
    ]))
    expect(facts.rows[0]?.provenance).toEqual([
      { source: 'example-bundle', sourceBasis: 'observed', relation: 'introduced', basis: 'derived' },
      { source: 'cordis.patch.yml', sourceBasis: 'observed', relation: 'patched-by', basis: 'derived' }
    ])
    expect(facts.rows[0]?.removedConfigKeys).toBeUndefined()
  })

  test('preserves missing provenance, static evidence and runtime unknowns', () => {
    const report = analyseComposition({
      profileDir: 'C:/fixture', rows: [{ id: 'static-row', source: 'cordis.yml', config: { handler: "!!js () => 'not run'" }, evidenceKind: 'static' }],
      adapterDiagnostics: [], evidenceMode: 'static'
    })
    expect(report.compositionFacts?.rows[0]).toMatchObject({ evidenceMode: 'static', provenance: [], replacement: { state: 'unknown', basis: 'unknown' } })
    expect(report.compositionFacts?.rows[0]?.unknown.join(' ')).toContain('provenance chain is unavailable')
    expect(report.compositionFacts?.rows[0]?.unknown.join(' ')).toContain('runtime behavior was not observed')
  })

  test('does not report removed keys from static declarations as composed changes', () => {
    const report = analyseComposition({
      profileDir: 'C:/fixture', evidenceMode: 'static', adapterDiagnostics: [],
      rows: [
        { id: 'replace-row', source: 'cordis.yml', config: { enabled: true, mode: 'old' }, evidenceKind: 'static' },
        { id: 'replace-row', source: 'cordis.patch.yml', config: { mode: 'new' }, replacement: true, evidenceKind: 'static' }
      ]
    })
    const later = report.compositionFacts?.rows.find((row) => row.source === 'cordis.patch.yml')
    expect(later?.removedConfigKeys).toBeUndefined()
    expect(later?.unknown.join(' ')).toContain('final composed row is unknown')
  })

  test('impact lists only exact bundle source matches and keeps uncovered surfaces unknown', () => {
    const report = analyseComposition(model('C:/fixture'))
    const impact = compositionBundleImpact(report, 'example-bundle')
    expect(impact.rows.map((row) => row.id)).toEqual(['shared-row'])
    expect(impact.rows[0]?.provenance.some((item) => item.relation === 'patched-by' && item.source === 'example-bundle')).toBe(false)
    expect(impact.diagnostics.map((item) => item.id)).toContain('row-note')
    expect(impact.unknown).toEqual(expect.arrayContaining([
      'route ownership: not observed / not modelled', 'slot ownership: not observed / not modelled',
      'runtime hook ownership: not observed / not modelled', 'arbitrary dependencies: not modelled', 'possible dependents: not modelled'
    ]))
  })

  test('an override is attributed only when the bundle is named as a later patch source', () => {
    const report = analyseComposition({
      profileDir: 'C:/fixture', evidenceMode: 'composed', adapterDiagnostics: [],
      rows: [{ id: 'shared-row', source: 'base-bundle', provenance: ['base-bundle', 'example-bundle'], replacement: true, replacementBasis: 'observed', evidenceKind: 'composed' }],
      installedPackages: [
        { name: 'base-bundle', installedVersion: '1.0.0', packageJsonSource: 'C:/fixture/node_modules/base-bundle/package.json' },
        { name: 'example-bundle', installedVersion: '2.0.0', packageJsonSource: 'C:/fixture/node_modules/example-bundle/package.json' }
      ]
    })
    const impact = compositionBundleImpact(report, 'example-bundle')
    expect(impact.rows).toHaveLength(1)
    expect(impact.rows[0]?.provenance).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'example-bundle', relation: 'patched-by', basis: 'derived' })
    ]))
    expect(impact.rows[0]?.replacement).toEqual({ state: 'yes', basis: 'observed' })
  })

  test('supports legacy report objects without composition facts', () => {
    const legacy: AnalysisReport = {
      schemaVersion: 1, evidenceSchemaVersion: 2, generatedAt: '2026-09-23T00:00:00Z', profileDir: '<PROFILE>',
      evidenceMode: 'static', runtimeObserved: false, unverifiedFindings: [], diagnostics: []
    }
    const impact = compositionBundleImpact(legacy, 'missing-bundle')
    expect(impact.rows).toEqual([])
    expect(impact.evidenceMode).toBe('static')
    expect(impact.unknown).toContain('route ownership: not observed / not modelled')
  })
})
