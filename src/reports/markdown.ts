import type { AnalysisReport, Diagnostic, Evidence } from '../core/types.js'

function formatEvidence(item: Evidence): string {
  const subject = item.subject === undefined ? '' : ` — ${item.subject}`
  const packageLabel = item.packageName === undefined ? '' : ` (${item.packageName}${item.version === undefined ? '' : `@${item.version}`})`
  return `- \`${item.source}\`${subject}${packageLabel}: ${item.detail}`
}

function formatDiagnostic(item: Diagnostic): string {
  const evidence = item.evidence.length === 0 ? '- No concrete source evidence was supplied.' : item.evidence.map(formatEvidence).join('\n')
  return `## [${item.severity.toUpperCase()}] ${item.title}\n\n${item.explanation}\n\nEvidence:\n${evidence}\n\nRemediation: ${item.remediation}`
}

export function renderMarkdown(report: AnalysisReport): string {
  const summary = ['error', 'warning', 'info'].map((severity) => `${severity}: ${report.diagnostics.filter((item) => item.severity === severity).length}`).join(', ')
  const body = report.diagnostics.length === 0 ? 'No diagnostics were produced.' : report.diagnostics.map(formatDiagnostic).join('\n\n')
  return `# DSH Composition Doctor Report\n\nSchema: ${report.schemaVersion}\n\nProfile: \`${report.profileDir}\`\n\nGenerated: ${report.generatedAt}\n\nSummary: ${summary}\n\n${body}\n`
}
