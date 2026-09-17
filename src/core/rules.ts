import type { AnalysisReport, BundleFact, CompositionModel, Diagnostic, Evidence, EvidenceKind, PatchWrite } from './types.js'
import { satisfies as semverSatisfies } from 'semver'

function evidence(source: string, subject: string, detail: string, evidenceKind: EvidenceKind, packageName?: string, version?: string): Evidence {
  return { source, subject, detail, evidenceKind, ...(packageName === undefined ? {} : { packageName }), ...(version === undefined ? {} : { version }) }
}

function diagnostic(id: string, severity: Diagnostic['severity'], title: string, items: readonly Evidence[], explanation: string, remediation: string): Diagnostic {
  return { id, severity, title, evidence: [...items], explanation, remediation }
}

function groups<T>(values: readonly T[], key: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>()
  for (const value of values) {
    const groupKey = key(value)
    const group = result.get(groupKey)
    if (group === undefined) result.set(groupKey, [value])
    else group.push(value)
  }
  return result
}

function parseVersion(value: string): readonly [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value)
  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])]
}

/**
 * Evaluate a package-manager semver range without any network access. The
 * includePrerelease option matters for the verified DSH preview range.
 */
function satisfiesRange(version: string, range: string): boolean | undefined {
  if (parseVersion(version) === undefined || range.trim().length === 0) return undefined
  try {
    return semverSatisfies(version, range, { includePrerelease: true })
  } catch {
    return undefined
  }
}

function patchEvidence(write: PatchWrite): Evidence {
  return evidence(write.source, write.path, `patch write to ${write.path}`, write.evidenceKind, write.packageName, write.version)
}

function peerDiagnostics(model: CompositionModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const runtime = model.runtime ?? {}
  for (const peer of model.peerRequirements ?? []) {
    for (const [fact, range] of [['dsh', peer.dsh], ['cordis', peer.cordis], ['node', peer.node]] as const) {
      if (range === undefined) continue
      const actual = runtime[fact]
      const item = evidence(peer.source, `${peer.packageName}:${fact}`, `requires ${fact} ${range}; observed ${actual ?? 'unknown'}`, peer.evidenceKind, peer.packageName)
      if (actual === undefined) {
        diagnostics.push(diagnostic('peer-version-facts-unavailable', 'warning', 'Runtime version fact is unavailable', [item], `The ${fact} version needed to evaluate ${peer.packageName} was not supplied.`, 'Provide the selected runtime version or treat this static compatibility finding as unproven.'))
        continue
      }
      if (satisfiesRange(actual, range) === false) {
        diagnostics.push(diagnostic('peer-version-mismatch', 'warning', 'Declared peer range does not match runtime fact', [item], `${peer.packageName} declares ${fact} ${range}, but the supplied runtime fact is ${actual}. Static analysis cannot prove the runtime load outcome.`, `Use a ${fact} version within ${range}, or update the package peer declaration after testing the supported combination.`))
      } else if (satisfiesRange(actual, range) === undefined) {
        diagnostics.push(diagnostic('peer-range-unrecognized', 'warning', 'Peer dependency range could not be evaluated', [item], `The declared ${fact} range ${range} is not understood by the offline semver adapter, so compatibility is unproven.`, `Verify ${peer.packageName} against ${fact} ${actual} using the package manager's resolver.`))
      }
    }
  }
  return diagnostics
}

function bundleDiagnostics(bundles: readonly BundleFact[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const bundle of bundles) {
    if ((bundle.gitRef !== undefined && bundle.gitRef.length > 0) || (bundle.integrity !== undefined && bundle.integrity.length > 0)) continue
    diagnostics.push(diagnostic('missing-provenance', 'warning', 'Bundle provenance is unavailable', [evidence(bundle.source, bundle.name, 'No Git ref or registry integrity was observed.', bundle.evidenceKind, bundle.name, bundle.version)], `The origin of ${bundle.name} cannot be verified from the selected metadata.`, 'Record an immutable Git ref or registry integrity hash in the selected package metadata.'))
  }
  for (const [name, group] of groups(bundles.filter((bundle) => bundle.profile !== undefined), (bundle) => bundle.name)) {
    if (new Set(group.map((bundle) => bundle.version ?? 'unknown')).size < 2) continue
    diagnostics.push(diagnostic('cross-profile-bundle-drift', 'warning', 'Bundle versions drift across profiles', group.map((bundle) => evidence(bundle.source, name, `profile ${bundle.profile ?? 'unknown'} declares ${bundle.version ?? 'unknown'}`, bundle.evidenceKind, bundle.name, bundle.version)), `${name} has different declared versions across compared profile metadata.`, 'Align the intended bundle version, or keep the profiles intentionally divergent and document why.'))
  }
  return diagnostics
}

function rowKeys(row: CompositionModel['rows'][number]): Set<string> {
  if (row.configKeys !== undefined) return new Set(row.configKeys)
  if (row.config !== null && typeof row.config === 'object' && !Array.isArray(row.config)) return new Set(Object.keys(row.config as Record<string, unknown>))
  return new Set()
}

function rowDiagnostics(rows: CompositionModel['rows']): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const [id, group] of groups(rows.filter((row) => row.id !== undefined), (row) => row.id as string)) {
    const layers = groups(group, (row) => row.layer ?? row.source)
    if (layers.size === 1 && group.length > 1) {
      diagnostics.push(diagnostic('duplicate-row-in-same-layer', 'warning', 'Duplicate composition row id in one layer', group.map((row) => evidence(row.source, id, `row id ${id} is declared more than once in the same layer`, row.evidenceKind, row.name)), `The DSH public row semantics do not establish which declaration should win within one layer for ${id}.`, 'Give the row a unique id or verify the final resolved tree with a public dump provider.'))
      continue
    }
    if (layers.size < 2) continue
    const ordered = [...group].sort((left, right) => (left.layerOrder ?? Number.MAX_SAFE_INTEGER) - (right.layerOrder ?? Number.MAX_SAFE_INTEGER))
    const previous = ordered[ordered.length - 2]
    const current = ordered[ordered.length - 1]
    diagnostics.push(diagnostic('intentional-row-override', 'info', 'Later composition layer overrides a row', [evidence(previous.source, id, `row id ${id} is overridden by a later layer`, previous.evidenceKind, previous.name), evidence(current.source, id, `row id ${id} replaces the earlier row`, current.evidenceKind, current.name)], `The same row id occurs across layers, which is compatible with DSH patch precedence when the later layer intentionally owns the row.`, 'Confirm the resolved provenance and keep the override documented.'))
    const missing = [...rowKeys(previous)].filter((key) => !rowKeys(current).has(key)).sort()
    if (missing.length > 0 && (current.replacement === true || current.configKeys !== undefined)) {
      diagnostics.push(diagnostic('row-config-replacement-risk', 'warning', 'Row replacement drops earlier config keys', [evidence(current.source, id, `replacement omits keys: ${missing.join(', ')}`, current.evidenceKind, current.name)], `The later row replacement for ${id} does not contain all keys observed in the earlier config. Secret values are not included.`, 'Copy the required non-secret config keys into the replacing row or verify that their absence is intentional.'))
    }
  }
  return diagnostics
}

function uiMode(claim: NonNullable<CompositionModel['uiClaims']>[number]): NonNullable<NonNullable<CompositionModel['uiClaims']>[number]['mode']> {
  if (claim.mode !== undefined) return claim.mode
  if (claim.kind === 'sidebar') return 'list-contribution'
  if (claim.kind === 'web-route') return 'exact-route'
  return 'single-owner'
}

function uiDiagnostics(claims: readonly NonNullable<CompositionModel['uiClaims']>[number][]): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const [claim, values] of groups(claims, (value) => `${uiMode(value)}:${value.kind}:${value.value}`)) {
    if (values.length < 2) continue
    const mode = uiMode(values[0]!)
    if (mode === 'list-contribution' && new Set(values.map((value) => value.contributionId ?? value.packageName ?? value.source)).size > 1) continue
    const severity = mode === 'prefix-route' ? 'warning' : 'error'
    const id = mode === 'exact-route' ? 'ui-exact-route-conflict' : mode === 'fallback-owner' ? 'ui-fallback-owner-conflict' : 'ui-ownership-conflict'
    diagnostics.push(diagnostic(id, severity, mode === 'exact-route' ? 'Exact web route has multiple owners' : 'UI ownership claim conflicts', values.map((value) => evidence(value.source, claim, `${value.kind} ${value.value}`, value.evidenceKind, value.packageName, value.version)), mode === 'prefix-route' ? `Multiple prefix route claims may shadow one another; ownership is not proven.` : `Multiple concrete declarations claim the same ${claim} surface.`, 'Assign one owner, or provide distinct list contribution ids where the public UI API allows multiple contributors.'))
  }
  return diagnostics
}

export function analyseComposition(model: CompositionModel): AnalysisReport {
  const diagnostics: Diagnostic[] = [...model.adapterDiagnostics]
  const requestedMode = model.evidenceMode ?? 'static'
  const runtimeObserved = requestedMode === 'runtime-observed' && model.runtimeObservation?.observed === true
  if (requestedMode === 'runtime-observed' && !runtimeObserved) {
    diagnostics.push(diagnostic('runtime-observation-unavailable', 'warning', 'Runtime observation is unavailable', [], 'The model requested runtime-observed evidence without a successful isolated runtime observation.', 'Keep this finding composed or static until a supported isolation backend returns observed runtime facts.'))
  }
  diagnostics.push(...rowDiagnostics(model.rows), ...uiDiagnostics(model.uiClaims ?? []))
  for (const [hook, values] of groups((model.hooks ?? []).filter((value) => value.hook === 'tools/pre-execute' || value.hook === 'tools/execute' || value.hook === 'tools/post-execute'), (value) => value.hook)) {
    if (values.length < 2) continue
    diagnostics.push(diagnostic('hook-order-risk', 'warning', 'Multiple tool waterfall registrations', values.map((value) => evidence(value.source, hook, `registered ${hook}`, value.evidenceKind, value.packageName, value.version)), `Multiple listeners register ${hook}; runtime listener order is unverified.`, 'Declare explicit ordering where the public DSH API supports it, then verify the resolved hook order in an isolated fixture.'))
  }
  for (const [path, writes] of groups(model.patchWrites ?? [], (write) => write.path)) {
    if (writes.length < 2) continue
    diagnostics.push(diagnostic('patch-field-overlap', 'warning', 'Patch fields overlap', writes.map(patchEvidence), `Multiple patches write ${path}; the winning value depends on resolution order not established by static evidence.`, 'Merge the writes into one owner or document and verify the intentional precedence.'))
  }
  diagnostics.push(...peerDiagnostics(model), ...bundleDiagnostics(model.bundles ?? []))
  const platform = model.runtime?.platform
  for (const requirement of model.platforms ?? []) {
    const item = evidence(requirement.source, requirement.packageName, `supports ${requirement.supported.join(', ')}; observed ${platform ?? 'unknown'}`, requirement.evidenceKind, requirement.packageName)
    const excluded = requirement.supported.includes(`!${platform ?? ''}`)
    const positive = requirement.supported.filter((value) => !value.startsWith('!'))
    const supported = platform !== undefined && !excluded && (positive.length === 0 || positive.includes(platform))
    if (!supported) {
      diagnostics.push(diagnostic('platform-mismatch', 'warning', 'Declared platform does not include selected runtime', [item], platform === undefined ? `No runtime platform was supplied for ${requirement.packageName}.` : `${requirement.packageName} declares ${requirement.supported.join(', ')}, not ${platform}.`, 'Use a supported platform or verify an intentional override in an isolated fixture.'))
    }
  }
  diagnostics.sort((left, right) => left.id.localeCompare(right.id) || left.title.localeCompare(right.title) || left.evidence[0]?.source.localeCompare(right.evidence[0]?.source ?? '') || 0)
  const evidenceMode = runtimeObserved ? 'runtime-observed' : requestedMode === 'runtime-observed' ? 'composed' : requestedMode
  const unverifiedFindings = diagnostics.filter((item) => item.id === 'runtime-composition-unavailable' || item.evidence.some((entry) => entry.evidenceKind === 'static')).map((item) => item.id)
  return { schemaVersion: 1, evidenceSchemaVersion: 2, generatedAt: new Date().toISOString(), profileDir: model.profileDir, evidenceMode, runtimeObserved, ...(model.metadataCoverage === undefined ? {} : { metadataCoverage: model.metadataCoverage }), unverifiedFindings, diagnostics }
}
