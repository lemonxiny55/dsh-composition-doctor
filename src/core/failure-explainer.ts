import type { AnalysisReport, CompositionRowFact, Diagnostic, EvidenceKind } from './types.js'

export type FailurePattern = 'duplicate-loader-entry' | 'bundle-unavailable' | 'bundle-patch-unavailable' | 'patch-target-missing' | 'peer-incompatible' | 'config-replacement'
export interface FailureSignature { pattern: FailurePattern; entity?: string }
export interface FailurePath {
  source: string; layer?: string; packageName?: string; rowId?: string; rowKey?: string
  provenance: CompositionRowFact['provenance']; evidence: EvidenceKind
}
export interface FailureExplanation {
  pattern: FailurePattern
  detectedFailure: string
  origin: 'reported-by-log' | 'observed-from-composition'
  matchedEntity?: { kind: 'row' | 'package'; id: string }
  causeStatus: 'observable-condition' | 'unknown'
  observableCause: string
  provenancePaths: readonly FailurePath[]
  evidenceLevel: EvidenceKind | 'unknown'
  unknowns: readonly string[]
  manualRemediation: string
  relatedDiagnostics: readonly Diagnostic[]
}
export interface FailureResult {
  schemaVersion: 1
  outcome: 'explained' | 'unknown' | 'no-match' | 'no-supported-issues'
  profile: '<PROFILE>'
  runtime: 'not-observed'
  input: { log: 'not-provided' | 'reported-by-log'; recognizedSignatures: number; truncated: boolean }
  explanations: readonly FailureExplanation[]
  unknowns: readonly string[]
  nextStep: string
}
export interface FailureInput { report: AnalysisReport; log?: string }
export const maxFailureLogBytes = 1024 * 1024

const titles: Record<FailurePattern, string> = {
  'duplicate-loader-entry': 'Duplicate loader entry id', 'bundle-unavailable': 'Profile bundle cannot be resolved',
  'bundle-patch-unavailable': 'Bundle patch is unavailable', 'patch-target-missing': 'Patch entry not found',
  'peer-incompatible': 'Plugin peer/version incompatibility', 'config-replacement': 'Whole-config replacement / row override'
}
const ids: Record<FailurePattern, readonly string[]> = {
  'duplicate-loader-entry': ['duplicate-loader-declarations', 'duplicate-row-in-same-layer', 'intentional-row-override'],
  'bundle-unavailable': ['bundle-not-installed'],
  'bundle-patch-unavailable': ['bundle-patch-missing', 'bundle-patch-unavailable', 'bundle-patch-invalid', 'bundle-patch-unsafe'],
  'patch-target-missing': ['unmatched-patch-target'], 'peer-incompatible': ['peer-version-mismatch', 'peer-version-facts-unavailable'],
  'config-replacement': ['row-config-replacement-risk', 'intentional-row-override']
}

/** No raw log lines, stack traces, URLs, paths or values are persisted. */
export function safeFailureEntity(value: string): string | undefined {
  return /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_][a-z0-9_.:-]{0,159}$/i.test(value) &&
    !/(?:^(?:sk-|gh[pousr]_|eyJ)|token|password|credential|secret|authorization)/i.test(value) ? value : undefined
}

export function matchFailureSignatures(log: string): FailureSignature[] {
  const signatures = new Map<string, FailureSignature>()
  const entity = '(?:@[a-z0-9_.-]+/)?[a-z0-9_][a-z0-9_.:-]{0,159}'
  const add = (pattern: FailurePattern, value?: string) => {
    const candidate = value === undefined ? undefined : safeFailureEntity(value)
    if (value !== undefined && candidate === undefined) return
    const signature = { pattern, ...(candidate === undefined ? {} : { entity: candidate }) }
    if (signatures.size < 32) signatures.set(`${pattern}:${candidate ?? ''}`, signature)
  }
  // Bound the work before matching; strip terminal control sequences, never render them.
  const text = log.slice(0, maxFailureLogBytes).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
  for (const line of text.split(/\r?\n/)) {
    if (line.length > 4096) continue
    let match = new RegExp(`duplicate loader entry id:\\s*["']?(${entity})(?=["'\\s]|$)`, 'i').exec(line)
    if (match) add('duplicate-loader-entry', match[1])
    match = new RegExp(`cannot resolve profile bundle ["'](${entity})["']`, 'i').exec(line)
    if (match) add('bundle-unavailable', match[1])
    match = new RegExp(`patch:\\s*entry ["'](${entity})["'] not found`, 'i').exec(line)
    if (match) add('patch-target-missing', match[1])
    if (/failed to read overlay\b/i.test(line)) {
      match = new RegExp(`node_modules[\\\\/](${entity.replace('/', '[\\\\/]')})[\\\\/]cordis\\.patch\\.ya?ml(?=[\\s:]|$)`, 'i').exec(line)
      add('bundle-patch-unavailable', match?.[1]?.replaceAll('\\', '/'))
    }
    match = new RegExp(`incompatible-version:\\s*(${entity})(?=[\\s,]|$)`, 'i').exec(line)
    if (match) add('peer-incompatible', match[1])
    match = new RegExp(`Plugin (${entity})@[0-9][a-z0-9.+-]* is incompatible with dsh [0-9][a-z0-9.+-]*: peerDependencies`, 'i').exec(line)
    if (match) add('peer-incompatible', match[1])
    else if (/\bERR_PNPM_PEER_DEP_ISSUES\b|\bplugin compatibility failure\b/.test(line)) add('peer-incompatible')
  }
  return [...signatures.values()]
}

function path(row: CompositionRowFact): FailurePath {
  return { source: row.source, ...(row.layer === undefined ? {} : { layer: row.layer }),
    ...(row.packageName === undefined ? {} : { packageName: row.packageName }),
    ...(row.id === undefined ? {} : { rowId: row.id }), rowKey: row.key, provenance: row.provenance, evidence: row.evidenceMode }
}

function distinctRows(rows: readonly CompositionRowFact[]): CompositionRowFact[] {
  // Preserve same-layer duplicates with their own row keys.
  return [...new Map(rows.map((row) => [row.key, row])).values()]
}

function diagnosticEntities(diagnostic: Diagnostic): string[] {
  return [...new Set(diagnostic.evidence.flatMap((item) => {
    return [item.packageName, item.subject].filter((name): name is string => name !== undefined && safeFailureEntity(name) !== undefined)
  }))]
}

function explain(signature: FailureSignature, report: AnalysisReport, reported: boolean): FailureExplanation {
  const { pattern, entity } = signature
  const allRows = report.compositionFacts?.rows ?? []
  const rowPattern = pattern === 'duplicate-loader-entry' || pattern === 'patch-target-missing' || pattern === 'config-replacement'
  const rows = allRows.filter((row) => rowPattern ? row.id === entity :
    row.packageName === entity || row.provenance.some((step) => step.source === entity))
  const diagnostics = report.diagnostics.filter((item) => ids[pattern].includes(item.id) &&
    (entity === undefined || diagnosticEntities(item).includes(entity)))
  let paths: FailurePath[] = distinctRows(rows).map(path)
  let cause = 'unknown: the reported signature has no supporting condition in the selected profile evidence.'
  let observed = false
  let evidenceLevel: FailureExplanation['evidenceLevel'] = 'unknown'
  const unknowns = ['Runtime failure and plugin behavior: not observed / not-run.']
  let remediation = 'Check the selected profile directory and capture the first DSH error. Compare it with the observed rows; do not remove a plugin based on a log string alone.'
  if (pattern === 'duplicate-loader-entry') {
    const inserted = distinctRows(rows.filter((row) => row.operation === 'insert' || row.operation === 'declare'))
    const composed = distinctRows(rows.filter((row) => row.evidenceMode === 'composed'))
    const candidates = composed.length > 1 ? composed : inserted
    paths = candidates.map(path)
    if (candidates.length > 1) {
      observed = true
      evidenceLevel = composed.length > 1 ? 'composed' : 'static'
      cause = evidenceLevel === 'static'
        ? `${entity} is introduced by ${candidates.length} separate loader declarations. Both inserts use the same id; the final loader outcome is unknown until composition/runtime is observed.`
        : `${entity} occurs more than once in the observed composed tree. These entries share a loader id; runtime rejection was not observed by Doctor.`
    } else unknowns.push('Two independent loader insert paths were not observed. An update or provenance patch chain is not a second insertion.')
    remediation = 'Review the listed bundle declarations and profile patch. Keep one intended insertion for this id after checking its config; use why row and impact bundle for details.'
  } else if (pattern === 'config-replacement') {
    const updates = rows.filter((row) => row.operation === 'update' && row.replacement.state !== 'no')
    const replacements = rows.filter((row) => row.evidenceMode === 'composed' && row.replacement.state === 'yes')
    const chain = rows.filter((row) => row.provenance.length > 1)
    if (updates.length > 0 || replacements.length > 0 || chain.length > 0) {
      observed = true
      evidenceLevel = replacements.length > 0 || chain.some((row) => row.evidenceMode === 'composed') ? 'composed' : 'static'
      cause = replacements.length > 0 ? 'The composition provider explicitly reports a replacement for this row.' : updates.length > 0
        ? 'The profile declares a config update for this row. DSH patch semantics replace the whole config rather than deep-merge its keys.'
        : 'The public composition source chain records this row being patched by a later source. Whole-config replacement is unknown without explicit replacement evidence.'
      const previous = rows.filter((row) => row.operation === 'insert' || row.operation === 'declare')
      if (previous.length > 0 && updates.length > 0) {
        const dropped = previous.flatMap((row) => row.configKeys).filter((key) => !updates[updates.length - 1]!.configKeys.includes(key))
        if (dropped.length > 0) cause += ` The later declaration omits ${new Set(dropped).size} earlier config key(s); this is a static difference, not proof of runtime data loss.`
      }
      unknowns.push('Prior effective values, field ownership and runtime effects are unknown. A source chain alone does not prove removed keys.')
    }
    remediation = 'Review the earlier row and the later patch together. Include required non-secret fields in the complete replacement config, then compare snapshots/diff or run preflight before upgrading.'
  } else if (pattern === 'patch-target-missing') {
    const composedMissing = diagnostics.some((item) => item.evidence.some((entry) => entry.evidenceKind === 'composed' && entry.subject === entity))
    const updates = rows.filter((row) => row.operation === 'update')
    const introduction = rows.some((row) => row.operation === 'insert' || row.operation === 'declare')
    if (composedMissing || (updates.length > 0 && !introduction && !rows.some((row) => row.evidenceMode === 'composed'))) {
      observed = true; evidenceLevel = composedMissing ? 'composed' : 'static'
      cause = composedMissing ? 'The public dump provider reports that this patch target did not match a composed row.' :
        'A patch targets this id, but no insertion is present in the permitted selected profile metadata. A built-in, home or CLI layer could still supply it; final absence is unknown.'
    }
    remediation = 'Compare the patch id with the intended bundle row. Check whether the bundle is declared and available; inspect home/CLI layers manually if they supply the row.'
  } else {
    const supporting = diagnostics.filter((item) => pattern !== 'peer-incompatible' || item.id === 'peer-version-mismatch')
    if (supporting.length > 0 && entity !== undefined) {
      observed = true; evidenceLevel = 'static'
      cause = pattern === 'bundle-unavailable' ? 'This bundle is declared in dsh.profile.bundles, but the bounded resolver cannot read its package metadata inside the selected profile. An installation-level bundle or external link may still exist.' :
        pattern === 'bundle-patch-unavailable' ? 'The declared bundle has missing, invalid or disallowed patch metadata. Its manifest declaration does not supply an observable loader contribution.' :
          supporting.map((item) => item.evidence.map((entry) => entry.detail).join('; ')).join('; ')
    }
    paths = [...paths, ...diagnostics.flatMap((item) => item.evidence.map((entry) => ({ source: entry.source,
      ...(entry.packageName === undefined ? {} : { packageName: entry.packageName }), provenance: [], evidence: entry.evidenceKind })))]
    remediation = pattern === 'peer-incompatible' ? 'Compare the installed plugin peer range with the selected DSH version. Choose a tested compatible pair or rehearse it with preflight; a peer warning alone does not prove a crash.' :
      pattern === 'bundle-unavailable' ? 'Review package.json → dsh.profile.bundles and the intended installed package or link. Confirm installation-level resolution manually before reinstalling anything.' :
        'Review the bundle manifest → dsh.bundle.patch and packaged YAML file. Check the publisher tarball contents; do not substitute or execute a file suggested by the log.'
    if (pattern === 'peer-incompatible' && !observed) unknowns.push('The selected runtime version or exact affected package is unknown. Log-reported versions are not trusted runtime facts.')
  }
  if (evidenceLevel === 'static') unknowns.push('Final composition: unknown. Home/CLI overlays and installation-level bundles are not inspected by the default static reader.')
  if (entity === undefined) unknowns.push('Offending entity: unknown; multiple packages may fit. No package was selected by guessing.')
  const entityObserved = entity !== undefined && (rows.length > 0 || diagnostics.some((item) => diagnosticEntities(item).includes(entity)) || report.compositionFacts?.nodes.some((node) => node.entity === 'bundle' && node.label === entity) === true)
  if (entity !== undefined && !entityObserved) unknowns.push('Reported entity: not observed in selected profile/composition metadata.')
  if (paths.length === 0) unknowns.push('Provenance: unavailable / not observed.')
  return { pattern, detectedFailure: `${titles[pattern]}${entity === undefined ? '' : `: ${entity}`}`, origin: reported ? 'reported-by-log' : 'observed-from-composition',
    ...(!entityObserved || entity === undefined ? {} : { matchedEntity: { kind: rowPattern ? 'row' : 'package', id: entity } }),
    causeStatus: observed ? 'observable-condition' : 'unknown', observableCause: cause,
    provenancePaths: [...new Map(paths.map((entry) => [`${entry.rowKey ?? ''}|${entry.source}|${entry.layer ?? ''}|${entry.packageName ?? ''}`, entry])).values()], evidenceLevel, unknowns, manualRemediation: remediation, relatedDiagnostics: diagnostics }
}

/** Pure matching/explanation layer; log strings cannot create composition facts. */
export function explainFailures({ report, log }: FailureInput): FailureResult {
  const reported = log !== undefined
  const signatures = reported ? matchFailureSignatures(log) : []
  if (!reported) {
    const add = (pattern: FailurePattern, entity: string) => {
      if (safeFailureEntity(entity) !== undefined && !signatures.some((item) => item.pattern === pattern && item.entity === entity)) signatures.push({ pattern, entity })
    }
    const rows = report.compositionFacts?.rows ?? []
    for (const row of rows) {
      if (row.id === undefined) continue
      if (rows.filter((other) => other.id === row.id && (other.operation === 'insert' || other.operation === 'declare')).length > 1 ||
        rows.filter((other) => other.id === row.id && other.evidenceMode === 'composed').length > 1) add('duplicate-loader-entry', row.id)
      if (row.operation === 'update' && !rows.some((other) => other.id === row.id && (other.operation === 'insert' || other.operation === 'declare'))) add('patch-target-missing', row.id)
      if ((row.operation === 'update' && row.replacement.state !== 'no') || row.provenance.length > 1 || row.replacement.state === 'yes') add('config-replacement', row.id)
    }
    for (const diagnostic of report.diagnostics) {
      for (const pattern of ['bundle-unavailable', 'bundle-patch-unavailable', 'peer-incompatible'] as const) {
        if (!ids[pattern].includes(diagnostic.id) || diagnostic.id === 'peer-version-facts-unavailable') continue
        for (const name of [...new Set(diagnostic.evidence.map((entry) => entry.packageName ?? entry.subject).filter((value): value is string => value !== undefined))]) add(pattern, name)
      }
    }
  }
  const explanations = signatures.slice(0, 50).map((signature) => explain(signature, report, reported))
  const unreadable = report.diagnostics.filter((item) => ['profile-patch-invalid', 'bundle-inventory-manifest-invalid', 'runtime-composition-unavailable', 'composed-dump-parse-failed'].includes(item.id)).map((item) => item.id)
  return { schemaVersion: 1, outcome: explanations.some((item) => item.causeStatus === 'observable-condition') ? 'explained' :
    explanations.length > 0 || (!reported && unreadable.length > 0) ? 'unknown' : reported ? 'no-match' : 'no-supported-issues', profile: '<PROFILE>', runtime: 'not-observed',
    input: { log: reported ? 'reported-by-log' : 'not-provided', recognizedSignatures: signatures.length,
      truncated: signatures.length > 50 || (reported && signatures.length >= 32) || (log !== undefined && new TextEncoder().encode(log).length > maxFailureLogBytes) }, explanations,
    unknowns: ['A recognized log signature is a report, not trusted composition or runtime evidence.', 'An absence of supported findings is not a healthy runtime verification.', ...unreadable.map((id) => `Metadata coverage incomplete: ${id}.`)],
    nextStep: reported ? 'Review the named source paths. If the cause is unknown, verify the profile selection and compare a public dump, why row, snapshot/diff or preflight.' :
      'To focus on a startup symptom: dsh-doctor diagnose --profile <dir> --log <file> (or pipe DSH stderr to diagnose).' }
}
