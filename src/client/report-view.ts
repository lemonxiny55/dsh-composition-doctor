import type { AnalysisReport, Diagnostic, Severity } from '../core/types.js'
import { renderMarkdown } from '../reports/markdown.js'

export const clientReportPath = '/dsh-composition-doctor/reports/latest'
export type Translator = (key: string) => string

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
  return { report, counts, graph: buildConflictGraph(report) }
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

function download(document: Document, content: string, filename: string, mime: string): void {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([content], { type: mime }))
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

/**
 * Browser-native settings section. It only performs a GET and offers local
 * downloads; it contains no profile, package, configuration, or repair writes.
 */
export function createReportView(document: Document = globalThis.document, translate: Translator = (key) => ({
  title: 'DSH Composition Doctor', exportJson: 'Export JSON', exportMarkdown: 'Export Markdown', loading: 'Loading the latest local report…', unavailable: 'The latest report is unavailable.'
}[key] ?? key)): HTMLElement {
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
    button(document, translate('exportJson'), () => { void fetchReport().then((report) => download(document, `${JSON.stringify(report, null, 2)}\n`, 'dsh-composition-doctor-report.json', 'application/json')).catch(() => undefined) }),
    text(document, ' '),
    button(document, translate('exportMarkdown'), () => { void fetchReport().then((report) => download(document, renderMarkdown(report), 'dsh-composition-doctor-report.md', 'text/markdown')).catch(() => undefined) })
  )
  root.append(actions)
  void fetchReport().then((report) => {
    const model = toReportViewModel(report)
    status.textContent = `Diagnostics: ${model.counts.error} error, ${model.counts.warning} warning, ${model.counts.info} info. Conflict graph: ${model.graph.nodes.length} evidence nodes.`
    const list = document.createElement('ul')
    for (const diagnostic of report.diagnostics) {
      const item = document.createElement('li')
      item.textContent = `[${diagnostic.severity}] ${diagnostic.title}`
      list.append(item)
    }
    root.append(list)
  }).catch((error: unknown) => {
    status.textContent = error instanceof Error ? error.message : translate('unavailable')
  })
  return root
}

const nameForDom = 'dsh-composition-doctor'
