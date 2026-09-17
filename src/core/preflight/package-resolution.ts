import { satisfies } from 'semver'
import type { Evidence, RuntimeFacts } from '../types.js'

export type PackageResolutionStatus = 'compatible' | 'incompatible' | 'unknown' | 'unavailable'
export type PackageCheckStatus = 'pass' | 'fail' | 'unknown'

export interface PackageResolutionResult {
  packageName: string
  requestedVersion: string
  resolvedVersion?: string
  status: PackageResolutionStatus
  source: string
  integrity?: string
  sha512?: string
  checks: Readonly<Record<string, PackageCheckStatus>>
  evidence: readonly Evidence[]
}

function evidence(source: string, subject: string, detail: string, severity?: Evidence['severity']): Evidence {
  return { source, subject, detail, evidenceKind: 'static', ...(severity === undefined ? {} : { severity }) }
}

function rangeCheck(range: unknown, actual: string | undefined, subject: string, source: string, label: string, evidenceItems: Evidence[], checks: Record<string, PackageCheckStatus>): void {
  if (typeof range !== 'string') return
  if (actual === undefined) {
    checks[label] = 'unknown'
    evidenceItems.push(evidence(source, subject, `${label} requires ${range}, but the selected runtime fact is unavailable.`, 'warning'))
    return
  }
  try {
    const matches = satisfies(actual, range, { includePrerelease: true })
    checks[label] = matches ? 'pass' : 'fail'
    evidenceItems.push(evidence(source, subject, `${label} requires ${range}; observed ${actual}.`, matches ? undefined : 'warning'))
  } catch {
    checks[label] = 'unknown'
    evidenceItems.push(evidence(source, subject, `${label} declares an unsupported range ${range}.`, 'warning'))
  }
}

function listConstraint(value: unknown, actual: string, source: string, subject: string, label: string, evidenceItems: Evidence[], checks: Record<string, PackageCheckStatus>): void {
  if (value === undefined) return
  const values = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : typeof value === 'string' ? [value] : []
  if (values.length === 0) {
    checks[label] = 'unknown'
    evidenceItems.push(evidence(source, subject, `${label} constraint could not be interpreted.`, 'warning'))
    return
  }
  const excluded = values.some((item) => item.startsWith('!') && item.slice(1) === actual)
  const positive = values.filter((item) => !item.startsWith('!'))
  const matches = !excluded && (positive.length === 0 || positive.includes(actual))
  checks[label] = matches ? 'pass' : 'fail'
  evidenceItems.push(evidence(source, subject, `${label} declares ${values.join(', ')}; observed ${actual}.`, matches ? undefined : 'warning'))
}

export function evaluatePackageResolution(input: {
  packageName: string
  requestedVersion: string
  resolvedVersion?: string
  manifest?: Record<string, unknown>
  source: string
  integrity?: string
  sha512?: string
  runtime: RuntimeFacts
}): PackageResolutionResult {
  const evidenceItems: Evidence[] = []
  const checks: Record<string, PackageCheckStatus> = {}
  const manifest = input.manifest
  if (manifest === undefined || input.resolvedVersion === undefined) {
    return { packageName: input.packageName, requestedVersion: input.requestedVersion, resolvedVersion: input.resolvedVersion, status: 'unavailable', source: input.source, integrity: input.integrity, sha512: input.sha512, checks: { artifact: 'unknown' }, evidence: [evidence(input.source, input.packageName, 'Package metadata was not available for resolution.', 'warning')] }
  }

  checks.version = input.resolvedVersion === input.requestedVersion ? 'pass' : 'fail'
  evidenceItems.push(evidence(input.source, input.packageName, `Requested ${input.requestedVersion}; resolved ${input.resolvedVersion}.`, checks.version === 'pass' ? undefined : 'error'))
  const peers = manifest.peerDependencies !== null && typeof manifest.peerDependencies === 'object' ? manifest.peerDependencies as Record<string, unknown> : {}
  rangeCheck(peers['@deepseek-ai/dsh'], input.runtime.dsh, input.packageName, input.source, 'DSH peer', evidenceItems, checks)
  rangeCheck(peers['@deepseek-ai/cordis'], input.runtime.cordis, input.packageName, input.source, 'Cordis peer', evidenceItems, checks)
  const engines = manifest.engines !== null && typeof manifest.engines === 'object' ? manifest.engines as Record<string, unknown> : {}
  rangeCheck(engines.node, input.runtime.node, input.packageName, input.source, 'Node engine', evidenceItems, checks)
  listConstraint(manifest.os, input.runtime.platform ?? process.platform, input.source, input.packageName, 'OS', evidenceItems, checks)
  listConstraint(manifest.cpu, process.arch, input.source, input.packageName, 'CPU', evidenceItems, checks)

  const repository = manifest.repository
  const gitRef = typeof manifest.gitHead === 'string' ? manifest.gitHead : undefined
  if (input.integrity !== undefined || gitRef !== undefined || repository !== undefined) {
    evidenceItems.push(evidence(input.source, input.packageName, `Package provenance: ${input.integrity === undefined ? 'no registry integrity' : input.integrity}${gitRef === undefined ? '' : `; git ref ${gitRef}`}.`))
  } else {
    checks.provenance = 'unknown'
    evidenceItems.push(evidence(input.source, input.packageName, 'No registry integrity or fixed Git ref was supplied with this local artifact.', 'warning'))
  }

  const values = Object.values(checks)
  const status: PackageResolutionStatus = values.includes('fail') ? 'incompatible' : values.includes('unknown') ? 'unknown' : 'compatible'
  return { packageName: input.packageName, requestedVersion: input.requestedVersion, resolvedVersion: input.resolvedVersion, status, source: input.source, integrity: input.integrity, sha512: input.sha512, checks, evidence: evidenceItems }
}
