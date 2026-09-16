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
    if (bundle.gitRef !== undefined && bundle.gitRef.length > 0) continue
    diagnostics.push(diagnostic('missing-provenance', 'warning', 'Bundle provenance is unavailable', [evidence(bundle.source, bundle.name, 'No Git ref or immutable provenance was declared.', bundle.evidenceKind, bundle.name, bundle.version)], `The origin of ${bundle.name} cannot be verified from the selected metadata.`, 'Record an immutable Git ref, registry integrity hash, or other package provenance in the selected profile metadata.'))
  }
  for (const [name, group] of groups(bundles.filter((bundle) => bundle.profile !== undefined), (bundle) => bundle.name)) {
    if (new Set(group.map((bundle) => bundle.version ?? 'unknown')).size < 2) continue
    diagnostics.push(diagnostic('cross-profile-bundle-drift', 'warning', 'Bundle versions drift across profiles', group.map((bundle) => evidence(bundle.source, name, `profile ${bundle.profile ?? 'unknown'} declares ${bundle.version ?? 'unknown'}`, bundle.evidenceKind, bundle.name, bundle.version)), `${name} has different declared versions across compared profile metadata.`, 'Align the intended bundle version, or keep the profiles intentionally divergent and document why.'))
  }
  return diagnostics
}

export function analyseComposition(model: CompositionModel): AnalysisReport {
  const diagnostics: Diagnostic[] = [...model.adapterDiagnostics]
  for (const [id, rows] of groups(model.rows.filter((row) => row.id !== undefined), (row) => row.id as string)) {
    if (rows.length < 2) continue
    diagnostics.push(diagnostic('duplicate-row-id', 'error', 'Duplicate composition row id', rows.map((row) => evidence(row.source, id, `row id ${id}`, row.evidenceKind, row.name)), `Multiple concrete composition rows claim the id ${id}.`, 'Give one row a unique id or remove the duplicate declaration.'))
  }
  for (const [claim, values] of groups(model.uiClaims ?? [], (value) => `${value.kind}:${value.value}`)) {
    if (values.length < 2) continue
    diagnostics.push(diagnostic('ui-ownership-conflict', 'error', 'Duplicate UI ownership claim', values.map((value) => evidence(value.source, claim, `${value.kind} ${value.value}`, value.evidenceKind, value.packageName, value.version)), `Multiple concrete declarations claim the same ${claim} UI surface.`, 'Assign the UI surface to one package or give each declaration a distinct slot, layout, sidebar entry, or route.'))
  }
  for (const [hook, values] of groups((model.hooks ?? []).filter((value) => value.hook === 'tools/pre-execute' || value.hook === 'tools/execute' || value.hook === 'tools/post-execute'), (value) => value.hook)) {
    if (values.length < 2) continue
    diagnostics.push(diagnostic('hook-order-risk', 'warning', 'Multiple tool waterfall registrations', values.map((value) => evidence(value.source, hook, `registered ${hook}`, value.evidenceKind, value.packageName, value.version)), `Multiple listeners register ${hook}; static metadata does not establish their runtime order.`, 'Declare explicit ordering where the public DSH API supports it, then verify the resolved hook order in an isolated fixture.'))
  }
  for (const [path, writes] of groups(model.patchWrites ?? [], (write) => write.path)) {
    if (writes.length < 2) continue
    diagnostics.push(diagnostic('patch-field-overlap', 'warning', 'Patch fields overlap', writes.map(patchEvidence), `Multiple patches write ${path}; the winning value depends on resolution order not established by static evidence.`, 'Merge the writes into one owner or document and verify the intentional precedence.'))
  }
  diagnostics.push(...peerDiagnostics(model), ...bundleDiagnostics(model.bundles ?? []))
  const platform = model.runtime?.platform
  for (const requirement of model.platforms ?? []) {
    const item = evidence(requirement.source, requirement.packageName, `supports ${requirement.supported.join(', ')}; observed ${platform ?? 'unknown'}`, requirement.evidenceKind, requirement.packageName)
    if (platform === undefined || !requirement.supported.includes(platform)) {
      diagnostics.push(diagnostic('platform-mismatch', 'warning', 'Declared platform does not include selected runtime', [item], platform === undefined ? `No runtime platform was supplied for ${requirement.packageName}.` : `${requirement.packageName} declares ${requirement.supported.join(', ')}, not ${platform}.`, 'Use a supported platform or verify an intentional override in an isolated fixture.'))
    }
  }
  diagnostics.sort((left, right) => left.id.localeCompare(right.id) || left.title.localeCompare(right.title) || left.evidence[0]?.source.localeCompare(right.evidence[0]?.source ?? '') || 0)
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), profileDir: model.profileDir, diagnostics }
}
