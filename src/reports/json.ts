import type { AnalysisReport } from '../core/types.js'

export function renderJson(report: AnalysisReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}
