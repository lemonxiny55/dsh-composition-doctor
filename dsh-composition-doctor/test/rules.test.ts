import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { analyseComposition } from '../src/core/rules.js'
import { renderJson } from '../src/reports/json.js'
import { renderMarkdown } from '../src/reports/markdown.js'
import type { CompositionModel } from '../src/core/types.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

async function fixture(name: string): Promise<string> {
  return readFile(join(fixtures, name, 'cordis.yml'), 'utf8')
}

function model(overrides: Record<string, unknown>): CompositionModel {
  return {
    profileDir: 'C:/fixture/profile',
    rows: [],
    adapterDiagnostics: [],
    ...overrides
  } as CompositionModel
}

describe('analyseComposition', () => {
  it('reports duplicate row id as an error with both source paths', async () => {
    const source = await fixture('duplicate-row-id')
    const report = analyseComposition(model({
      rows: [
        { id: 'shared-row', source: 'cordis.yml', evidenceKind: 'static' },
        { id: 'shared-row', source: 'cordis.patch.yml', evidenceKind: 'static' }
      ],
      source
    }))

    expect(report.diagnostics).toContainEqual(expect.objectContaining({
      id: 'duplicate-row-id', severity: 'error', evidence: expect.arrayContaining([
        expect.objectContaining({ subject: 'shared-row', source: 'cordis.yml' }),
        expect.objectContaining({ subject: 'shared-row', source: 'cordis.patch.yml' })
      ])
    }))
  })

  it('reports concrete duplicate UI root slot, sidebar, layout, and web route claims as errors', async () => {
    await fixture('ui-conflict')
    const report = analyseComposition(model({
      uiClaims: [
        { kind: 'root-slot', value: 'settings', source: 'cordis.yml', packageName: 'first', evidenceKind: 'static' },
        { kind: 'root-slot', value: 'settings', source: 'cordis.patch.yml', packageName: 'second', evidenceKind: 'static' },
        { kind: 'sidebar', value: 'tools', source: 'cordis.yml', packageName: 'first', evidenceKind: 'static' },
        { kind: 'sidebar', value: 'tools', source: 'cordis.patch.yml', packageName: 'second', evidenceKind: 'static' },
        { kind: 'layout', value: 'main', source: 'cordis.yml', packageName: 'first', evidenceKind: 'static' },
        { kind: 'layout', value: 'main', source: 'cordis.patch.yml', packageName: 'second', evidenceKind: 'static' },
        { kind: 'web-route', value: '/doctor', source: 'cordis.yml', packageName: 'first', evidenceKind: 'static' },
        { kind: 'web-route', value: '/doctor', source: 'cordis.patch.yml', packageName: 'second', evidenceKind: 'static' }
      ]
    }))

    for (const kind of ['root-slot', 'sidebar', 'layout', 'web-route']) {
      expect(report.diagnostics).toContainEqual(expect.objectContaining({
        id: 'ui-ownership-conflict', severity: 'error', evidence: expect.arrayContaining([expect.objectContaining({ subject: expect.stringContaining(`${kind}:`) })])
      }))
    }
  })

  it('reports multiple execute waterfalls as a warning, not a confirmed failure', async () => {
    await fixture('hook-order')
    const report = analyseComposition(model({
      hooks: [
        { hook: 'tools/execute', source: 'cordis.yml', packageName: 'first', evidenceKind: 'static' },
        { hook: 'tools/execute', source: 'cordis.patch.yml', packageName: 'second', evidenceKind: 'static' }
      ]
    }))

    expect(report.diagnostics).toContainEqual(expect.objectContaining({ id: 'hook-order-risk', severity: 'warning' }))
  })

  it('reports multiple pre-execute and post-execute registrations as ordering warnings too', () => {
    const report = analyseComposition(model({
      hooks: [
        { hook: 'tools/pre-execute', source: 'first/cordis.yml', packageName: 'first', evidenceKind: 'static' },
        { hook: 'tools/pre-execute', source: 'second/cordis.yml', packageName: 'second', evidenceKind: 'static' },
        { hook: 'tools/post-execute', source: 'first/cordis.yml', packageName: 'first', evidenceKind: 'static' },
        { hook: 'tools/post-execute', source: 'second/cordis.yml', packageName: 'second', evidenceKind: 'static' }
      ]
    }))

    expect(report.diagnostics.filter((item) => item.id === 'hook-order-risk')).toHaveLength(2)
    expect(report.diagnostics.every((item) => item.severity === 'warning')).toBe(true)
  })

  it('warns when patch writes overlap the same field path', () => {
    const report = analyseComposition(model({
      patchWrites: [
        { path: 'plugins.shared.config.enabled', source: 'cordis.yml', packageName: 'first', evidenceKind: 'static' },
        { path: 'plugins.shared.config.enabled', source: 'cordis.patch.yml', packageName: 'second', evidenceKind: 'static' }
      ]
    }))
    expect(report.diagnostics).toContainEqual(expect.objectContaining({ id: 'patch-field-overlap', severity: 'warning' }))
  })

  it('warns with evidence and remediation for compatibility, provenance, drift, and platform uncertainty', async () => {
    await readFile(join(fixtures, 'peer-mismatch', 'package.json'), 'utf8')
    const report = analyseComposition(model({
      runtime: { dsh: '0.2.0', cordis: '5.0.0', node: '18.0.0', platform: 'win32' },
      bundles: [
        { name: 'doctor-plugin', version: '1.0.0', source: 'package.json', evidenceKind: 'static', gitRef: undefined, profile: 'profile-a' },
        { name: 'doctor-plugin', version: '2.0.0', source: 'other/package.json', evidenceKind: 'static', gitRef: undefined, profile: 'profile-b' }
      ],
      peerRequirements: [{ packageName: 'doctor-plugin', source: 'package.json', evidenceKind: 'static', dsh: '>=0.1.0-rc.5 <0.2.0', cordis: '>=4 <5', node: '>=20' }],
      platforms: [{ packageName: 'doctor-plugin', source: 'package.json', evidenceKind: 'static', supported: ['darwin'] }]
    }))

    for (const id of ['peer-version-mismatch', 'missing-provenance', 'cross-profile-bundle-drift', 'platform-mismatch']) {
      const diagnostic = report.diagnostics.find((item) => item.id === id)
      expect(diagnostic).toBeDefined()
      expect(diagnostic?.severity).toBe('warning')
      expect(diagnostic?.evidence.length).toBeGreaterThan(0)
      expect(diagnostic?.explanation).not.toHaveLength(0)
      expect(diagnostic?.remediation).not.toHaveLength(0)
    }
  })

  it('evaluates major-only peer ranges and reports every mismatch', () => {
    const report = analyseComposition(model({
      runtime: { dsh: '0.1.0-rc.6', cordis: '5.0.0', node: '18.20.0' },
      peerRequirements: [{ packageName: 'example', source: 'package.json', evidenceKind: 'static', dsh: '>=0.1.0-rc.5 <0.2.0', cordis: '>=4 <5', node: '>=20' }]
    }))

    const mismatches = report.diagnostics.filter((item) => item.id === 'peer-version-mismatch')
    expect(mismatches).toHaveLength(2)
    expect(mismatches.map((item) => item.evidence[0]?.subject)).toEqual(['example:cordis', 'example:node'])
  })
})

describe('report renderers', () => {
  it('render deterministic JSON and Markdown with evidence and remediation', () => {
    const report = analyseComposition(model({ rows: [{ id: 'duplicate', source: 'a.yml', evidenceKind: 'static' }, { id: 'duplicate', source: 'b.yml', evidenceKind: 'static' }] }))
    const json = renderJson(report)
    const markdown = renderMarkdown(report)

    expect(JSON.parse(json)).toMatchObject({ schemaVersion: 1 })
    expect(markdown).toContain('a.yml')
    expect(markdown).toContain('Remediation:')
  })
})
