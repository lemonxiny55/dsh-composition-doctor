import type { AnalysisReport, Diagnostic, Evidence } from '../core/types.js'

function formatEvidence(item: Evidence): string {
  const subject = item.subject === undefined ? '' : ` — ${item.subject}`
  const packageLabel = item.packageName === undefined ? '' : ` (${item.packageName}${item.version === undefined ? '' : `@${item.version}`})`
  return `- [${item.evidenceKind}] \`${item.source}\`${subject}${packageLabel}: ${item.detail}`
}

function formatDiagnostic(item: Diagnostic): string {
  const evidence = item.evidence.length === 0 ? '- No concrete source evidence was supplied.' : item.evidence.map(formatEvidence).join('\n')
  return `## [${item.severity.toUpperCase()}] ${item.title}\n\n${item.explanation}\n\nEvidence:\n${evidence}\n\nRemediation: ${item.remediation}`
}

export function renderMarkdown(report: AnalysisReport): string {
  const summary = ['error', 'warning', 'info'].map((severity) => `${severity}: ${report.diagnostics.filter((item) => item.severity === severity).length}`).join(', ')
  const body = report.diagnostics.length === 0 ? 'No diagnostics were produced.' : report.diagnostics.map(formatDiagnostic).join('\n\n')
  const coverage = report.metadataCoverage === undefined ? '' : `\nMetadata coverage: ${report.metadataCoverage.mode}; unscanned: ${report.metadataCoverage.unscannedSurfaces.join('; ')}\n`
  return `# DSH Composition Doctor Report\n\nSchema: ${report.schemaVersion}; evidence schema: ${report.evidenceSchemaVersion}\n\nProfile: \`${report.profileDir}\`\n\nGenerated: ${report.generatedAt}\n\nEvidence mode: ${report.evidenceMode}; runtime observed: ${report.runtimeObserved ? 'yes' : 'no'}\n${coverage}\nSummary: ${summary}\n\n${body}\n`
}
