import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { resolveComposition } from './composition-adapter.js'
import { tryDshDump } from './dsh-dump-provider.js'
import { readProfile } from './profile-reader.js'
import { redact, redactYamlPreservingTags } from './redaction.js'
import { analyseComposition } from './rules.js'
import type { CompositionModel, Evidence, ProfileInput, RuntimeFacts, Severity } from './types.js'
import { resolveDshArtifact } from './preflight/artifact-resolver.js'
import { resolveCandidateArtifact, type CandidateResolution } from './preflight/candidate-artifact-resolver.js'
import { evaluatePackageResolution, type PackageResolutionResult } from './preflight/package-resolution.js'

export interface PreflightOptions {
  profileDir: string
  targetDsh: string
  candidates: readonly string[]
  allowBuild: boolean
  online: boolean
  dshBin?: string
  dshPackage?: string
  artifactCacheDir?: string
  packageManagerCacheDirs?: readonly string[]
  /** Keep the redacted rehearsal directory for inspection. Defaults to false. */
  keepTemp?: boolean
}

export type PreflightOutcome = 'pass' | 'warning' | 'fail'

export interface PreflightResult {
  schemaVersion: 1
  outcome: PreflightOutcome
  profileDir: string
  targetDsh: string
  candidates: readonly string[]
  evidence: readonly Evidence[]
  diagnostics: ReturnType<typeof analyseComposition>['diagnostics']
  smokeTest: {
    outcome: PreflightOutcome
    detail: string
  }
  compositionSmoke: PreflightSmoke
  packageResolutionSmoke: PreflightSmoke
  packageResolutions: readonly PackageResolutionResult[]
  runtimeSmoke: PreflightSmoke
  realProfileFingerprintBefore?: string
  realProfileFingerprintAfter?: string
  tempDirectory?: string
}

export interface PreflightSmoke { outcome: PreflightOutcome | 'not-run'; detail: string }

const yamlFiles = new Set(['cordis.yml', 'cordis.patch.yml'])
const lockFiles = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'])
const packageNamePattern = /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i
const versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9a-z.-]+)?(?:\+[0-9a-z.-]+)?$/i

function evidence(source: string, subject: string, detail: string, severity?: Severity): Evidence {
  return { source, subject, detail, evidenceKind: 'static', ...(severity === undefined ? {} : { severity }) }
}

/** A digest of the allow-listed metadata surface; file contents are never returned. */
export function profileFingerprint(input: ProfileInput): string {
  const surface = input.files
    .map((file) => `${file.relativePath}\u0000${file.sha256}`)
    .sort()
    .join('\u0001')
  return createHash('sha256').update(surface, 'utf8').digest('hex')
}

function safeCandidate(value: string): boolean {
  const at = value.lastIndexOf('@')
  if (at <= 0 || at === value.length - 1) return false
  const name = value.slice(0, at)
  const version = value.slice(at + 1)
  return packageNamePattern.test(name) && versionPattern.test(version)
}

function candidateParts(value: string): { name: string; version: string } {
  const at = value.lastIndexOf('@')
  return { name: value.slice(0, at), version: value.slice(at + 1) }
}

function safeMetadataText(relativePath: string, text: string): string | undefined {
  try {
    if (relativePath === 'package.json') {
      return `${JSON.stringify(redact(JSON.parse(text)), null, 2)}\n`
    }
    if (yamlFiles.has(relativePath)) {
      return redactYamlPreservingTags(text)
    }
  } catch {
    // Invalid metadata is reported by the composition adapter; it is not copied
    // because copying an unparseable source could carry an undiscovered secret.
  }
  return undefined
}

async function prepareIsolatedProfile(input: ProfileInput, directory: string, candidates: readonly string[], evidenceItems: Evidence[]): Promise<void> {
  let wroteManifest = false
  for (const file of input.files) {
    if (lockFiles.has(file.relativePath)) {
      evidenceItems.push(evidence(file.relativePath, 'lockfile-not-copied', 'Lockfile content is excluded from the rehearsal directory; its source hash remains available in snapshots.'))
      continue
    }
    const safeText = safeMetadataText(file.relativePath, file.text)
    if (safeText === undefined) {
      evidenceItems.push(evidence(file.relativePath, 'metadata-not-copied', 'Metadata was not copied because it could not be safely parsed.'))
      continue
    }
    if (file.relativePath === 'package.json' && candidates.length > 0) {
      const manifest = JSON.parse(safeText) as Record<string, unknown>
      const dependencies = manifest.dependencies !== null && typeof manifest.dependencies === 'object' ? manifest.dependencies as Record<string, unknown> : {}
      for (const candidate of candidates) {
        const { name, version } = candidateParts(candidate)
        dependencies[name] = version
      }
      manifest.dependencies = dependencies
      await writeFile(join(directory, file.relativePath), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
      wroteManifest = true
      continue
    }
    await writeFile(join(directory, file.relativePath), safeText, { encoding: 'utf8', flag: 'wx' })
    if (file.relativePath === 'package.json') wroteManifest = true
  }
  if (!wroteManifest && candidates.length > 0) {
    const dependencies = Object.fromEntries(candidates.map((candidate) => {
      const { name, version } = candidateParts(candidate)
      return [name, version]
    }))
    await writeFile(join(directory, 'package.json'), `${JSON.stringify({ name: 'dsh-doctor-isolated-profile', private: true, dependencies }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  }
}

function runtimeForTarget(model: CompositionModel, targetDsh: string): CompositionModel {
  const runtime: RuntimeFacts = {
    ...(model.runtime ?? {}),
    dsh: targetDsh,
    node: model.runtime?.node ?? process.versions.node,
    platform: model.runtime?.platform ?? process.platform
  }
  return { ...model, runtime }
}

function outcomeFor(smoke: PreflightOutcome, diagnostics: readonly { severity: Severity }[], extraWarning: boolean): PreflightOutcome {
  if (smoke === 'fail' || diagnostics.some((item) => item.severity === 'error')) return 'fail'
  if (smoke === 'warning' || extraWarning || diagnostics.some((item) => item.severity === 'warning')) return 'warning'
  return 'pass'
}

/**
 * Builds a redacted rehearsal profile in the OS temp directory and performs
 * parse/adapter analysis there. It never invokes a package manager or a
 * third-party lifecycle; --allow-build is recorded as an explicit plan gate.
 */
export async function runPreflight(options: PreflightOptions): Promise<PreflightResult> {
  const requestedProfile = resolve(options.profileDir)
  const evidenceItems: Evidence[] = []
  let before: string | undefined
  let after: string | undefined
  let tempDirectory: string | undefined
  let smokeOutcome: PreflightOutcome = 'pass'
  let smokeDetail = 'No isolated smoke test was run.'
  let packageResolutionOutcome: PreflightOutcome | 'not-run' = 'not-run'
  let packageResolutionDetail = 'No candidate package was supplied.'
  const packageResolutions: PackageResolutionResult[] = []
  let diagnostics: ReturnType<typeof analyseComposition>['diagnostics'] = []
  let profileDir = requestedProfile
  let extraWarning = false

  try {
    if (!versionPattern.test(options.targetDsh)) {
      evidenceItems.push(evidence(requestedProfile, 'target-dsh-invalid', 'Target DSH version must be an explicit semantic version.', 'error'))
      return {
        schemaVersion: 1, outcome: 'fail', profileDir: requestedProfile, targetDsh: options.targetDsh,
        candidates: [], evidence: evidenceItems, diagnostics, smokeTest: { outcome: 'fail', detail: 'The target DSH version was rejected before rehearsal.' },
        compositionSmoke: { outcome: 'fail', detail: 'The target DSH version was rejected before rehearsal.' },
        packageResolutionSmoke: { outcome: 'not-run', detail: 'Target version validation failed before package resolution.' },
        packageResolutions: [],
        runtimeSmoke: { outcome: 'not-run', detail: 'Runtime execution was not attempted.' }
      }
    }

    const input = await readProfile({ profileDir: requestedProfile })
    profileDir = input.profileDir
    before = profileFingerprint(input)
    evidenceItems.push(evidence(profileDir, 'profile-fingerprint-before', `Allow-listed metadata fingerprint recorded: ${before}`))

    const invalidCandidates = options.candidates.filter((candidate) => !safeCandidate(candidate))
    if (invalidCandidates.length > 0) {
      extraWarning = true
      evidenceItems.push(evidence(profileDir, 'candidate-validation', `${invalidCandidates.length} candidate value(s) were omitted because they are not a simple package@version reference.`, 'warning'))
    }
    const candidates = options.candidates.filter(safeCandidate)
    const artifact = await resolveDshArtifact({ targetDsh: options.targetDsh, dshBin: options.dshBin, dshPackage: options.dshPackage, online: options.online, cacheDir: options.artifactCacheDir, packageManagerCacheDirs: options.packageManagerCacheDirs })
    const artifactProvenance = [artifact.detail, `source=${artifact.source}`, `requested=${artifact.requestedVersion}`, ...(artifact.resolvedVersion === undefined ? [] : [`resolved=${artifact.resolvedVersion}`]), ...(artifact.integrity === undefined ? [] : [`integrity=${artifact.integrity}`]), ...(artifact.sha512 === undefined ? [] : [`sha512=${artifact.sha512}`])].join(' ')
    evidenceItems.push(evidence(profileDir, 'target-artifact', artifactProvenance, artifact.kind === 'unavailable' || !artifact.targetVersionVerified ? 'warning' : undefined))
    packageResolutions.push(evaluatePackageResolution({ packageName: '@deepseek-ai/dsh', requestedVersion: options.targetDsh, resolvedVersion: artifact.resolvedVersion, manifest: artifact.manifest, source: artifact.source, integrity: artifact.integrity, sha512: artifact.sha512, runtime: { dsh: options.targetDsh, node: process.versions.node, platform: process.platform } }))
    const artifactDiagnostics: ReturnType<typeof analyseComposition>['diagnostics'] = artifact.kind === 'unavailable'
      ? [{ id: 'artifact-unavailable', severity: 'warning', title: 'Target DSH artifact unavailable', evidence: [{ source: profileDir, subject: 'target-artifact', detail: artifact.detail, evidenceKind: 'static' }], explanation: 'The requested target DSH release was not available from the permitted offline artifact sources.', remediation: 'Provide --dsh-bin, --dsh-package, a local tarball, or an installed target artifact; use --online only when network resolution is explicitly intended.' }]
      : !artifact.targetVersionVerified
        ? [{ id: 'artifact-version-unverified', severity: 'warning', title: 'Target DSH release is unverified', evidence: [{ source: artifact.path ?? profileDir, subject: 'target-artifact', detail: artifact.detail, evidenceKind: 'static' }], explanation: 'A local artifact candidate was found, but its version was not verified as the requested release.', remediation: 'Run the harness with a locally available exact release and verify its public --version output.' }]
        : []
    if (artifactDiagnostics.length > 0 || artifact.kind === 'unavailable') extraWarning = true
    evidenceItems.push(evidence(profileDir, 'target-dsh', `Rehearsal target is DSH ${options.targetDsh}.`))
    evidenceItems.push(evidence(profileDir, 'candidate-plugins', `${candidates.length} validated candidate plugin reference(s) supplied; values are not copied into the real profile.`))
    const candidateResolutions: CandidateResolution[] = []
    for (const candidate of candidates) {
      evidenceItems.push(evidence(profileDir, 'candidate-accepted', `${candidate} was accepted as an exact package@version reference.`))
      const resolution = await resolveCandidateArtifact(requestedProfile, candidate, options.online, options.artifactCacheDir, options.packageManagerCacheDirs)
      candidateResolutions.push(resolution)
      evidenceItems.push(evidence(profileDir, resolution.status === 'resolved' ? 'candidate-artifact-resolved' : 'candidate-declaration-recorded', resolution.detail, resolution.status === 'resolved' ? undefined : 'warning'))
      packageResolutions.push(resolution.status === 'resolved' && resolution.artifact !== undefined
        ? evaluatePackageResolution({ packageName: resolution.artifact.name, requestedVersion: resolution.artifact.requestedVersion, resolvedVersion: resolution.artifact.installedVersion, manifest: resolution.artifact.manifest, source: resolution.artifact.source, integrity: resolution.artifact.integrity, sha512: resolution.artifact.sha512, runtime: { dsh: options.targetDsh, node: process.versions.node, platform: process.platform } })
        : { packageName: candidateParts(candidate).name, requestedVersion: candidateParts(candidate).version, status: 'unavailable', source: 'unavailable', checks: { artifact: 'unknown' }, evidence: [{ source: profileDir, subject: candidate, detail: resolution.detail, evidenceKind: 'static', severity: 'warning' }] })
      evidenceItems.push(evidence(profileDir, 'candidate-package-not-installed', `${candidate} was not downloaded or installed.`))
      evidenceItems.push(evidence(profileDir, 'candidate-runtime-unverified', `${candidate} was not loaded, so runtime compatibility is unverified.`, 'warning'))
    }
    const nonCompatible = packageResolutions.filter((resolution) => resolution.status !== 'compatible')
    packageResolutionOutcome = nonCompatible.some((resolution) => resolution.status === 'incompatible') ? 'fail' : nonCompatible.length > 0 ? 'warning' : 'pass'
    packageResolutionDetail = packageResolutions.length === 0
      ? 'No target or candidate package artifact was available for package-resolution checks.'
      : `${nonCompatible.length} of ${packageResolutions.length} package artifact resolution(s) are not proven compatible; no package-manager install or lifecycle was executed.`
    if (candidates.length > 0) extraWarning = true
    evidenceItems.push(evidence(profileDir, 'network-policy', options.online ? 'Online mode was explicitly requested; exact registry artifacts may be downloaded into Doctor-owned cache only.' : 'Offline mode enforced; no network operation was attempted.'))
    tempDirectory = await mkdtemp(join(tmpdir(), 'dsh-doctor-'))
    await prepareIsolatedProfile(input, tempDirectory, candidates, evidenceItems)
    evidenceItems.push(evidence(tempDirectory, 'isolated-profile', 'Only redacted, allow-listed composition metadata was copied into the temporary profile.'))

    try {
      const isolatedInput = await readProfile({ profileDir: tempDirectory })
       const staticModel = runtimeForTarget(await resolveComposition(isolatedInput), options.targetDsh)
       const dumped = artifact.kind === 'dsh-bin' && artifact.path !== undefined ? await tryDshDump(isolatedInput, { dshBin: artifact.path }) : undefined
       const isolatedModel: CompositionModel = dumped === undefined ? staticModel : { ...staticModel, rows: dumped.rows, adapterDiagnostics: [...staticModel.adapterDiagnostics.filter((item) => item.id !== 'runtime-composition-unavailable'), ...dumped.diagnostics], evidenceMode: 'composed' }
      const report = analyseComposition(isolatedModel)
      const candidateDiagnostics = candidateResolutions.filter((resolution) => resolution.status === 'unavailable').map((resolution) => {
        const candidate = resolution.candidate
        const { name, version } = candidateParts(candidate)
        return {
          id: 'candidate-artifact-unavailable', severity: 'warning' as const, title: 'Candidate artifact was not resolved',
          evidence: [{ source: tempDirectory ?? profileDir, subject: candidate, packageName: name, version, detail: resolution.detail, evidenceKind: 'static' as const }],
          explanation: 'A package declaration is not evidence that the candidate package manifest or runtime can be loaded.',
          remediation: 'Provide a local exact artifact or use an explicit supported online resolver, then re-run the isolated rehearsal.'
        }
      })
      const packageDiagnostics = packageResolutions.filter((resolution) => resolution.status !== 'compatible').map((resolution) => ({
        id: `package-resolution-${resolution.status}`, severity: resolution.status === 'incompatible' ? 'error' as const : 'warning' as const,
        title: `Package resolution is ${resolution.status}`,
        evidence: [...resolution.evidence],
        explanation: `Package metadata resolution for ${resolution.packageName}@${resolution.requestedVersion} is ${resolution.status}.`,
        remediation: resolution.status === 'unavailable' ? 'Provide an exact local artifact or use explicit --online registry resolution.' : 'Supply the missing runtime facts or use a compatible package version.'
      }))
      diagnostics = [...artifactDiagnostics, ...report.diagnostics, ...candidateDiagnostics, ...packageDiagnostics]
      const errors = diagnostics.filter((item) => item.severity === 'error').length
      const warnings = diagnostics.filter((item) => item.severity === 'warning').length
      smokeOutcome = errors > 0 ? 'fail' : warnings > 0 ? 'warning' : 'pass'
      smokeDetail = `Static composition parse and public-adapter resolution completed in isolation (${errors} error(s), ${warnings} warning(s)).`
      evidenceItems.push(evidence(tempDirectory, 'smoke-test', smokeDetail, smokeOutcome === 'fail' ? 'error' : smokeOutcome === 'warning' ? 'warning' : undefined))
    } catch (error: unknown) {
      smokeOutcome = 'fail'
      smokeDetail = error instanceof Error ? error.message : String(error)
      evidenceItems.push(evidence(tempDirectory, 'smoke-test', `Isolated composition smoke test failed: ${smokeDetail}`, 'error'))
    }

    evidenceItems.push(evidence(profileDir, 'build-plan', options.allowBuild ? 'Build execution was explicitly allowed, but no public build runner is configured; no third-party lifecycle was invoked.' : 'Build candidates would be rehearsed here only after explicit --allow-build.'))
    evidenceItems.push(evidence(profileDir, 'build-not-executed', 'No package-manager install or build script was executed by this preflight.', options.allowBuild ? 'warning' : undefined))
    if (options.allowBuild) extraWarning = true
  } catch (error: unknown) {
    smokeOutcome = 'fail'
    smokeDetail = error instanceof Error ? error.message : String(error)
    evidenceItems.push(evidence(requestedProfile, 'preflight-error', smokeDetail, 'error'))
  } finally {
    try {
      const afterInput = await readProfile({ profileDir: requestedProfile })
      after = profileFingerprint(afterInput)
      const unchanged = before === undefined || before === after
      evidenceItems.push(evidence(profileDir, 'profile-unchanged', unchanged ? `Allow-listed metadata fingerprint is unchanged: ${after}` : `Allow-listed metadata fingerprint changed from ${before} to ${after}`, unchanged ? undefined : 'error'))
      if (!unchanged) smokeOutcome = 'fail'
    } catch (error: unknown) {
      smokeOutcome = 'fail'
      evidenceItems.push(evidence(requestedProfile, 'profile-fingerprint-after', `Could not verify the selected profile after rehearsal: ${error instanceof Error ? error.message : String(error)}`, 'error'))
    }
    if (tempDirectory !== undefined && !options.keepTemp) {
      await rm(tempDirectory, { recursive: true, force: true })
      evidenceItems.push(evidence(tempDirectory, 'temp-cleanup', 'Temporary rehearsal directory was removed.'))
      tempDirectory = undefined
    }
  }

  const outcome = outcomeFor(smokeOutcome, diagnostics, extraWarning)
  return {
    schemaVersion: 1,
    outcome,
    profileDir,
    targetDsh: options.targetDsh,
    candidates: options.candidates.filter(safeCandidate),
    evidence: evidenceItems,
    diagnostics,
    smokeTest: { outcome: smokeOutcome, detail: smokeDetail },
    compositionSmoke: { outcome: smokeOutcome, detail: smokeDetail },
    packageResolutionSmoke: { outcome: packageResolutionOutcome, detail: packageResolutionDetail },
    packageResolutions,
    runtimeSmoke: { outcome: 'not-run', detail: 'Third-party runtime execution requires an explicit supported isolation backend; the temporary directory is not a security sandbox.' },
    ...(before === undefined ? {} : { realProfileFingerprintBefore: before }),
    ...(after === undefined ? {} : { realProfileFingerprintAfter: after }),
    ...(tempDirectory === undefined ? {} : { tempDirectory })
  }
}
