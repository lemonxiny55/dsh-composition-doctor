import { createElement, useEffect, useRef } from 'react'

import type { AnalysisReport, CompositionFacts, CompositionGraphNode, Diagnostic, Severity } from '../core/types.js'
import { renderMarkdown } from '../reports/markdown.js'

export const clientReportPath = '/dsh-composition-doctor/reports/latest'
export const downloadRevokeDelayMs = 1000
export type Translator = (key: string) => string

export interface DownloadHooks {
  createObjectURL(blob: Blob): string
  revokeObjectURL(url: string): void
  schedule(callback: () => void, delay: number): unknown
}

export interface ExportDependencies {
  fetcher?: typeof fetch
  download?: typeof download
}

export interface ConflictNode {
  id: string
  label: string
  source: string
}

export interface ConflictEdge {
  from: string
  to: string
  diagnosticId: string
}

export interface ConflictGraph {
  nodes: readonly ConflictNode[]
  edges: readonly ConflictEdge[]
}

export interface ReportViewModel {
  report: AnalysisReport
  counts: Readonly<Record<Severity, number>>
  graph: ConflictGraph
  compositionGraph: { nodes: readonly CompositionGraphNode[]; edges: CompositionFacts['edges'] }
}

export interface CompositionNodeDetail {
  title: string
  fields: readonly { label: string; value: string }[]
  diagnostics: readonly Diagnostic[]
  unknown: readonly string[]
}

export function evidenceBadgeLabel(mode: AnalysisReport['evidenceMode'], runtimeObserved: boolean): string {
  if (mode === 'runtime-observed' && runtimeObserved) return 'runtime-observed'
  if (mode === 'runtime-observed') return 'composed; runtime not observed'
  if (mode === 'composed') return 'composed; runtime not observed'
  if (mode === 'mixed') return runtimeObserved ? 'mixed; runtime observed' : 'mixed; runtime not observed'
  if (mode === 'resolved') return 'legacy resolved; runtime not observed'
  return 'static'
}

export function buildConflictGraph(report: AnalysisReport): ConflictGraph {
  const nodes = new Map<string, ConflictNode>()
  const edges: ConflictEdge[] = []
  for (const diagnostic of report.diagnostics) {
    const evidence = diagnostic.evidence
    const evidenceNodes = evidence.map((item, index) => {
      const id = `${diagnostic.id}:${index}`
      nodes.set(id, { id, label: item.subject ?? item.packageName ?? item.detail, source: item.source })
      return id
    })
    for (let index = 1; index < evidenceNodes.length; index += 1) {
      edges.push({ from: evidenceNodes[0]!, to: evidenceNodes[index]!, diagnosticId: diagnostic.id })
    }
  }
  return { nodes: [...nodes.values()], edges }
}

export function toReportViewModel(report: AnalysisReport): ReportViewModel {
  const counts: Record<Severity, number> = { info: 0, warning: 0, error: 0 }
  for (const diagnostic of report.diagnostics) counts[diagnostic.severity] += 1
  return {
    report, counts, graph: buildConflictGraph(report),
    compositionGraph: { nodes: report.compositionFacts?.nodes ?? [], edges: report.compositionFacts?.edges ?? [] }
  }
}

export function compositionNodeDetail(report: AnalysisReport, nodeId: string): CompositionNodeDetail | undefined {
  const facts = report.compositionFacts
  const node = facts?.nodes.find((candidate) => candidate.id === nodeId)
  if (facts === undefined || node === undefined) return undefined
  const relatedRows = facts.rows.filter((candidate) => {
    if (node.rowKey !== undefined) return candidate.key === node.rowKey
    if (node.entity === 'bundle') return candidate.packageName === node.packageName || candidate.provenance.some((step) => step.source === node.label)
    if (node.entity === 'source') return candidate.source === node.source || candidate.provenance.some((step) => step.source === node.source)
    if (node.entity === 'layer') return candidate.layer === node.layer && (node.layerOrder === undefined || candidate.layerOrder === node.layerOrder)
    if (node.entity === 'diagnostic') return node.diagnosticId !== undefined && candidate.relatedDiagnosticIds.includes(node.diagnosticId)
    return false
  })
  const fields: Array<{ label: string; value: string }> = [
    { label: 'entity', value: node.entity },
    { label: 'source', value: node.source ?? node.label },
    { label: 'evidence', value: node.evidenceMode ?? 'unknown' }
  ]
  if (node.layer !== undefined) fields.push({ label: 'layer', value: node.layer })
  if (node.layerOrder !== undefined) fields.push({ label: 'layer order', value: String(node.layerOrder) })
  if (node.packageName !== undefined) fields.push({ label: 'package', value: `${node.packageName}${node.packageVersion === undefined ? '' : `@${node.packageVersion}`}` })
  if (relatedRows.length > 0) {
    fields.push({ label: 'related rows', value: relatedRows.map((row) => row.id ?? row.name ?? row.key).join(', ') })
    fields.push({ label: 'config keys', value: relatedRows.map((row) => `${row.id ?? row.key}: ${row.configKeys.length === 0 ? '(none observed)' : row.configKeys.join(', ')}`).join('\n') })
    fields.push({ label: 'replacement', value: relatedRows.map((row) => `${row.id ?? row.key}: ${row.replacement.state} (${row.replacement.basis})`).join('\n') })
    fields.push({ label: 'provenance', value: relatedRows.map((row) => `${row.id ?? row.key}: ${row.provenance.length === 0 ? 'unknown' : row.provenance.map((item) => `${item.relation}: ${item.source} (${item.basis})`).join(' → ')}`).join('\n') })
  }
  const relatedDiagnosticIds = new Set(relatedRows.flatMap((row) => row.relatedDiagnosticIds))
  const rowDiagnostics = report.diagnostics.filter((item) => relatedDiagnosticIds.has(item.id))
  const nodeDiagnostic = node.diagnosticId === undefined ? [] : report.diagnostics.filter((item) => item.id === node.diagnosticId)
  return {
    title: node.label,
    fields,
    diagnostics: [...new Map([...rowDiagnostics, ...nodeDiagnostic].map((item) => [item.id, item])).values()],
    unknown: [...new Set([...relatedRows.flatMap((row) => row.unknown), ...facts.unknownSurfaces])]
  }
}

function renderConflictGraph(document: Document, graph: ConflictGraph): HTMLElement {
  const section = document.createElement('section')
  section.setAttribute('aria-labelledby', 'dsh-composition-doctor-conflict-graph')
  const heading = document.createElement('h3')
  heading.id = 'dsh-composition-doctor-conflict-graph'
  heading.textContent = 'Conflict graph'
  section.append(heading)
  const list = document.createElement('ul')
  for (const node of graph.nodes) {
    const item = document.createElement('li')
    const outgoing = graph.edges.filter((edge) => edge.from === node.id).map((edge) => graph.nodes.find((candidate) => candidate.id === edge.to)?.label ?? edge.to)
    item.textContent = `${node.label} (${node.source})${outgoing.length === 0 ? '' : ` → ${outgoing.join(', ')}`}`
    list.append(item)
  }
  if (graph.nodes.length === 0) {
    const item = document.createElement('li')
    item.textContent = 'No evidence relationships were produced.'
    list.append(item)
  }
  section.append(list)
  return section
}

export function createCompositionExplorer(document: Document, report: AnalysisReport): HTMLElement {
  const section = document.createElement('section')
  section.setAttribute('aria-labelledby', 'dsh-composition-doctor-explorer')
  const heading = document.createElement('h3')
  heading.id = 'dsh-composition-doctor-explorer'
  heading.textContent = 'Composition Explorer'
  section.append(heading)
  const facts = report.compositionFacts
  const graph = facts === undefined ? { nodes: [], edges: [] } : { nodes: facts.nodes, edges: facts.edges }
  if (graph.nodes.length === 0) {
    const message = document.createElement('p')
    message.textContent = 'Composition provenance is unavailable in this legacy report.'
    section.append(message)
  } else {
    const list = document.createElement('ul')
    for (const node of graph.nodes.filter((value) => value.entity !== 'diagnostic')) {
      const item = document.createElement('li')
      const select = button(document, `${node.entity}: ${node.label}`, () => {
        const detail = compositionNodeDetail(report, node.id)
        if (detail === undefined) return
        const panel = section.querySelector('[data-composition-detail]')
        if (panel === null) return
        panel.replaceChildren()
        const title = document.createElement('h4')
        title.textContent = detail.title
        panel.append(title)
        const fields = document.createElement('dl')
        for (const field of detail.fields) {
          const term = document.createElement('dt'); term.textContent = field.label
          const value = document.createElement('dd'); value.textContent = field.value
          fields.append(term, value)
        }
        panel.append(fields)
        const diagnostics = document.createElement('ul')
        for (const diagnostic of detail.diagnostics) {
          const entry = document.createElement('li')
          entry.textContent = `[${diagnostic.severity}] ${diagnostic.title}: ${diagnostic.explanation}`
          diagnostics.append(entry)
        }
        if (detail.diagnostics.length > 0) panel.append(diagnostics)
        const unknown = document.createElement('ul')
        for (const value of detail.unknown) { const entry = document.createElement('li'); entry.textContent = value; unknown.append(entry) }
        if (detail.unknown.length > 0) {
          const unknownTitle = document.createElement('h4'); unknownTitle.textContent = 'Unknown / not modelled'
          panel.append(unknownTitle, unknown)
        }
      })
      select.dataset.compositionNode = node.id
      item.append(select)
      const outgoing = graph.edges.filter((edge) => edge.from === node.id)
      if (outgoing.length > 0) {
        const relationships = document.createElement('ul')
        for (const edge of outgoing) {
          const target = graph.nodes.find((candidate) => candidate.id === edge.to)
          if (target === undefined || target.entity === 'diagnostic') continue
          const relationship = document.createElement('li')
          relationship.textContent = `${edge.relation} → ${target.label} (${edge.basis}; ${edge.evidenceMode})`
          relationships.append(relationship)
        }
        item.append(relationships)
      }
      list.append(item)
    }
    section.append(list)
    const detail = document.createElement('section')
    detail.dataset.compositionDetail = 'true'
    detail.setAttribute('aria-live', 'polite')
    detail.textContent = 'Select a bundle, source, layer, or row to inspect its evidence.'
    section.append(detail)
    const unknownList = document.createElement('ul')
    for (const value of facts?.unknownSurfaces ?? []) { const entry = document.createElement('li'); entry.textContent = value; unknownList.append(entry) }
    const unknownTitle = document.createElement('h4'); unknownTitle.textContent = 'Other surfaces'
    section.append(unknownTitle, unknownList)
  }
  return section
}

function isReport(value: unknown): value is AnalysisReport {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as { schemaVersion?: unknown; diagnostics?: unknown }
  return candidate.schemaVersion === 1 && Array.isArray(candidate.diagnostics)
}

function text(document: Document, value: string): Text {
  return document.createTextNode(value)
}

function button(document: Document, label: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = label
  element.addEventListener('click', onClick)
  return element
}

async function fetchReport(fetcher: typeof fetch = globalThis.fetch): Promise<AnalysisReport> {
  const response = await fetcher(clientReportPath, { method: 'GET', cache: 'no-store' })
  if (!response.ok) throw new Error(`Report request failed (${response.status})`)
  const value: unknown = await response.json()
  if (!isReport(value)) throw new Error('The latest report has an unsupported schema.')
  return value
}

const browserDownloadHooks: DownloadHooks = {
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  schedule: (callback, delay) => globalThis.setTimeout(callback, delay)
}

/** Create a local browser download without sending report data anywhere. */
export function download(document: Document, content: string, filename: string, mime: string, hooks: DownloadHooks = browserDownloadHooks): void {
  const blob = new Blob([content], { type: mime })
  const link = document.createElement('a')
  const objectUrl = hooks.createObjectURL(blob)
  link.hidden = true
  link.href = objectUrl
  link.download = filename
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    hooks.schedule(() => hooks.revokeObjectURL(objectUrl), downloadRevokeDelayMs)
  }
}

export async function exportReport(document: Document, format: 'json' | 'markdown', dependencies: ExportDependencies = {}): Promise<void> {
  const report = await fetchReport(dependencies.fetcher)
  if (format === 'json') {
    ;(dependencies.download ?? download)(document, `${JSON.stringify(report, null, 2)}\n`, 'dsh-composition-doctor-report.json', 'application/json')
    return
  }
  ;(dependencies.download ?? download)(document, renderMarkdown(report), 'dsh-composition-doctor-report.md', 'text/markdown')
}

/**
 * Browser-native settings section. It only performs a GET and offers local
 * downloads; it contains no profile, package, configuration, or repair writes.
 */
export function createReportView(document: Document = globalThis.document, translate: Translator = (key) => ({
  title: 'DSH Composition Doctor', exportJson: 'Export JSON', exportMarkdown: 'Export Markdown', loading: 'Loading the latest local report…', unavailable: 'The latest report is unavailable.'
}[key] ?? key), dependencies: ExportDependencies = {}): HTMLElement {
  const root = document.createElement('section')
  root.dataset.plugin = nameForDom
  root.setAttribute('aria-labelledby', 'dsh-composition-doctor-title')
  const heading = document.createElement('h2')
  heading.id = 'dsh-composition-doctor-title'
  heading.append(text(document, translate('title')))
  root.append(heading)
  const status = document.createElement('p')
  status.textContent = translate('loading')
  root.append(status)
  const actions = document.createElement('p')
  actions.append(
    button(document, translate('exportJson'), () => { void exportReport(document, 'json', dependencies).catch(() => undefined) }),
    text(document, ' '),
    button(document, translate('exportMarkdown'), () => { void exportReport(document, 'markdown', dependencies).catch(() => undefined) })
  )
  root.append(actions)
  void fetchReport(dependencies.fetcher).then((report) => {
    const model = toReportViewModel(report)
    const badge = document.createElement('span')
    badge.dataset.evidenceKind = report.evidenceMode
    badge.setAttribute('aria-label', 'Evidence capability')
    badge.textContent = `Evidence: ${evidenceBadgeLabel(report.evidenceMode, report.runtimeObserved === true)}`
    status.textContent = `Generated: ${report.generatedAt}. Profile: ${report.profileDir}. Diagnostics: ${model.counts.error} error, ${model.counts.warning} warning, ${model.counts.info} info.`
    status.append(document.createTextNode(' '), badge)
    root.append(renderConflictGraph(document, model.graph))
    root.append(createCompositionExplorer(document, report))
    const list = document.createElement('ul')
    for (const diagnostic of report.diagnostics) {
      const item = document.createElement('li')
      const details = document.createElement('details')
      const summary = document.createElement('summary')
      summary.textContent = `[${diagnostic.severity}] ${diagnostic.title}`
      details.append(summary)
      const explanation = document.createElement('p')
      explanation.textContent = diagnostic.explanation
      const evidence = document.createElement('pre')
      evidence.textContent = diagnostic.evidence.map((entry) => `${entry.source}: ${entry.detail}`).join('\n') || 'No concrete evidence.'
      const remediation = document.createElement('p')
      remediation.textContent = `Remediation: ${diagnostic.remediation}`
      details.append(explanation, evidence, remediation)
      item.append(details)
      list.append(item)
    }
    root.append(list)
  }).catch(() => {
    status.textContent = translate('unavailable')
  })
  return root
}

/**
 * DSH settings slots are rendered by React. Keep the browser-native report
 * view as the implementation detail, but mount it through a React component
 * rather than returning an HTMLElement directly to the slot renderer.
 */
export function ReportView({ translate }: { translate: Translator }): unknown {
  const host = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const container = host.current
    if (container === null) return
    const view = createReportView(globalThis.document, translate)
    container.replaceChildren(view)
    return () => {
      view.remove()
      container.replaceChildren()
    }
  }, [translate])
  return createElement('div', { className: 'dsh-composition-doctor-report-view', ref: host })
}

const nameForDom = 'dsh-composition-doctor'
