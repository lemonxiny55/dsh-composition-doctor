import type { FailureResult } from '../core/failure-explainer.js'

export function renderFailure(result: FailureResult, markdown = false): string {
  const lines = [markdown ? '# DSH Composition Doctor — Failure Explanation' : 'DSH Composition Doctor — Failure Explanation', '',
    `Profile: ${result.profile}; runtime: ${result.runtime}`, '']
  if (result.explanations.length === 0) lines.push(result.outcome === 'no-match'
    ? 'No supported failure signature matched. Cause: unknown.' : result.outcome === 'unknown' ? 'Selected metadata could not be fully inspected. Cause: unknown.' : 'No supported composition issue was observed. Runtime health: unknown.', '')
  for (const item of result.explanations.slice(0, markdown ? 50 : 3)) {
    lines.push(`${markdown ? '## ' : ''}${item.detectedFailure}`, `${item.origin}; evidence: ${item.evidenceLevel}`, '',
      `Cause: ${item.observableCause}`, '')
    for (const [index, path] of item.provenancePaths.entries()) {
      lines.push(`Path ${index + 1}: ${path.packageName === undefined ? '' : `bundle ${path.packageName} → `}${path.source}`,
        `  ${path.layer === undefined ? 'layer: unknown' : `layer: ${path.layer}`}${path.rowId === undefined ? '' : ` → row: ${path.rowId}`}`)
      if (path.provenance.length > (markdown ? 0 : 1)) lines.push(`  provenance: ${path.provenance.map((step) => `${step.relation}: ${step.source} (${step.basis})`).join(' → ')}`)
    }
    const unknown = markdown ? item.unknowns.join(' ') : `runtime not observed / not-run${item.evidenceLevel === 'static' ? '; final composition unknown' : ''}${item.causeStatus === 'unknown' ? '; cause unproven' : ''}.`
    lines.push('', `Unknown: ${unknown}`, `Next: ${item.manualRemediation}`, '')
  }
  if (!markdown && result.explanations.length > 3) lines.push(`${result.explanations.length - 3} more explanation(s); use --format json or markdown.`, '')
  if (markdown || result.explanations.length === 0 || result.input.log === 'not-provided') lines.push(result.nextStep)
  lines.push('Doctor did not modify your profile.', '')
  return lines.join('\n')
}
