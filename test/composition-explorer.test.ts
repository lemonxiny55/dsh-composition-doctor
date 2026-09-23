import { expect, test, vi } from 'vitest'

vi.mock('react', () => ({ createElement: () => ({}), useEffect: () => undefined, useRef: <T>(current: T) => ({ current }) }))

import { createCompositionExplorer, compositionNodeDetail, toReportViewModel } from '../src/client/report-view.js'
import { analyseComposition } from '../src/core/rules.js'
import type { AnalysisReport, CompositionModel } from '../src/core/types.js'

class FakeElement {
  children: FakeElement[] = []
  dataset: Record<string, string> = {}
  attributes = new Map<string, string>()
  handlers = new Map<string, () => void>()
  textContent = ''
  id = ''
  tagName: string

  constructor(tagName: string) { this.tagName = tagName }
  setAttribute(name: string, value: string) { this.attributes.set(name, value) }
  append(...children: FakeElement[]) { this.children.push(...children) }
  replaceChildren(...children: FakeElement[]) { this.children = [...children] }
  addEventListener(name: string, callback: () => void) { this.handlers.set(name, callback) }
  querySelector(selector: string): FakeElement | null {
    if (selector === '[data-composition-detail]') return this.find((item) => item.dataset.compositionDetail === 'true')
    return null
  }
  find(predicate: (item: FakeElement) => boolean): FakeElement | null {
    if (predicate(this)) return this
    for (const child of this.children) { const found = child.find(predicate); if (found !== null) return found }
    return null
  }
  all(): FakeElement[] { return [this, ...this.children.flatMap((child) => child.all())] }
  click() { this.handlers.get('click')?.() }
  text(): string { return [this.textContent, ...this.children.map((child) => child.text())].filter(Boolean).join(' ') }
}

function fixtureReport(): AnalysisReport {
  const model: CompositionModel = {
    profileDir: 'C:/Users/person/profile', evidenceMode: 'composed', runtimeObservation: { observed: false },
    rows: [{ id: 'shared-row', source: 'bundle-one', provenance: ['bundle-one', 'cordis.patch.yml'], layer: 'profile', layerOrder: 2, replacement: true, replacementBasis: 'derived', config: { enabled: true, token: 'not-to-serialize' }, evidenceKind: 'composed' }],
    installedPackages: [{ name: 'bundle-one', installedVersion: '1.0.0', packageJsonSource: 'C:/Users/person/profile/node_modules/bundle-one/package.json' }],
    adapterDiagnostics: [{ id: 'shared-row-conflict', severity: 'info', title: 'Row provenance note', evidence: [{ source: 'cordis.patch.yml', subject: 'shared-row', detail: 'A row-specific finding.', evidenceKind: 'composed' }], explanation: 'Related evidence.', remediation: 'None.' }]
  }
  return analyseComposition(model)
}

test('Web composition graph and node detail use the versioned report facts', () => {
  const report = fixtureReport()
  const viewModel = toReportViewModel(report)
  expect(viewModel.compositionGraph.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({ relation: 'introduced' }),
    expect.objectContaining({ relation: 'patched-by' }),
    expect.objectContaining({ relation: 'diagnosed-by' })
  ]))
  const rowNode = report.compositionFacts!.nodes.find((node) => node.entity === 'row')!
  const detail = compositionNodeDetail(report, rowNode.id)
    expect(detail?.fields).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: 'config keys', value: 'shared-row: enabled, token' }),
    expect.objectContaining({ label: 'replacement', value: 'shared-row: unknown (unknown)' }),
    expect.objectContaining({ label: 'provenance', value: expect.stringContaining('patched-by: cordis.patch.yml') })
  ]))
  expect(detail?.diagnostics.map((item) => item.id)).toContain('shared-row-conflict')
  expect(detail?.unknown).toContain('route ownership: not observed / not modelled')
})

test('selecting a Web graph node fills the detail panel; old reports remain viewable', () => {
  const report = fixtureReport()
  const document = { createElement: (tag: string) => new FakeElement(tag) } as unknown as Document
  const explorer = createCompositionExplorer(document, report) as unknown as FakeElement
  const bundleNode = report.compositionFacts!.nodes.find((node) => node.entity === 'bundle')!
  const select = explorer.all().find((element) => element.dataset.compositionNode === bundleNode.id)!
  select.click()
  const panel = explorer.find((element) => element.dataset.compositionDetail === 'true')!
  expect(panel.text()).toContain('shared-row')
  expect(panel.text()).toContain('enabled, token')
  expect(panel.text()).toContain('route ownership: not observed / not modelled')
  expect(panel.text()).toContain('Row provenance note')
  expect(panel.text()).not.toContain('not-to-serialize')

  const legacy = { ...report, compositionFacts: undefined }
  expect(toReportViewModel(legacy).compositionGraph).toEqual({ nodes: [], edges: [] })
  const legacyExplorer = createCompositionExplorer(document, legacy) as unknown as FakeElement
  expect(legacyExplorer.text()).toContain('unavailable in this legacy report')
})
