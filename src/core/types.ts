export type Severity = 'info' | 'warning' | 'error'

export interface Evidence {
  source: string
  detail: string
  subject?: string
  packageName?: string
  version?: string
  evidenceKind: EvidenceKind
  severity?: Severity
}

export interface Diagnostic {
  id: string
  severity: Severity
  title: string
  evidence: Evidence[]
  explanation: string
  remediation: string
}

export type EvidenceKind = 'static' | 'composed' | 'runtime-observed'
/** @deprecated Accepted only while reading reports created before evidence v2. */
export type LegacyEvidenceKind = 'resolved'
export type EvidenceMode = 'static' | 'composed' | 'runtime-observed' | 'mixed'
/** @deprecated Accepted only while reading reports created before evidence v2. */
export type LegacyEvidenceMode = 'resolved'

export interface RuntimeObservation {
  observed: boolean
  backend?: string
  detail?: string
}

export interface MetadataCoverage {
  mode: 'allow-listed-root-metadata'
  scannedFiles: readonly string[]
  unscannedSurfaces: readonly string[]
}

export interface ProfileFile {
  relativePath: string
  sha256: string
  text: string
}

export interface ProfileInput {
  profileDir: string
  files: readonly ProfileFile[]
  metadataCoverage: MetadataCoverage
  installedPackages: readonly InstalledPackageFact[]
  inventoryDiagnostics: readonly Diagnostic[]
}

export interface InstalledPackageFact {
  name: string
  requestedSpec?: string
  installedVersion?: string
  packageJsonSource: string
  bundlePatch?: string
  repository?: string
  gitRef?: string
  integrity?: string
  modifiedAt?: string
  platform?: readonly string[]
  peerDsh?: string
  peerCordis?: string
  engineNode?: string
  lifecycleScripts?: readonly string[]
}

export interface CompositionRow {
  id?: string
  name?: string
  source: string
  config?: unknown
  evidenceKind: EvidenceKind
  layer?: string
  layerOrder?: number
  configKeys?: readonly string[]
  replacement?: boolean
  replacementBasis?: 'observed' | 'derived'
  provenance?: readonly string[]
}

export type FactBasis = 'observed' | 'derived'

export interface CompositionSourceFact {
  source: string
  sourceBasis: 'observed'
  relation: 'introduced' | 'patched-by'
  basis: FactBasis
}

export interface CompositionReplacementFact {
  state: 'yes' | 'no' | 'unknown'
  basis: FactBasis | 'unknown'
}

export interface CompositionRowFact {
  entity: 'row'
  key: string
  id?: string
  name?: string
  source: string
  sourceBasis: 'observed'
  layer?: string
  layerOrder?: number
  provenance: readonly CompositionSourceFact[]
  replacement: CompositionReplacementFact
  configKeys: readonly string[]
  configKeysBasis: FactBasis
  evidenceMode: EvidenceKind
  packageName?: string
  packageVersion?: string
  relatedDiagnosticIds: readonly string[]
  removedConfigKeys?: readonly string[]
  unknown: readonly string[]
}

export interface CompositionGraphNode {
  id: string
  entity: 'bundle' | 'source' | 'layer' | 'row' | 'diagnostic'
  label: string
  source?: string
  layer?: string
  layerOrder?: number
  packageName?: string
  packageVersion?: string
  evidenceMode?: EvidenceKind
  rowKey?: string
  diagnosticId?: string
}

export interface CompositionGraphEdge {
  from: string
  to: string
  relation: 'introduced' | 'patched-by' | 'source-of' | 'contains' | 'diagnosed-by' | 'package-source'
  basis: FactBasis
  evidenceMode: EvidenceKind
}

/** Additive, redacted report facts used by CLI explanations and the Web graph. */
export interface CompositionFacts {
  schemaVersion: 1
  evidenceMode: EvidenceMode
  nodes: readonly CompositionGraphNode[]
  edges: readonly CompositionGraphEdge[]
  rows: readonly CompositionRowFact[]
  unknownSurfaces: readonly string[]
}

export interface UiClaim {
  kind: 'root-slot' | 'sidebar' | 'layout' | 'web-route'
  value: string
  source: string
  packageName?: string
  version?: string
  evidenceKind: EvidenceKind
  mode?: 'list-contribution' | 'single-owner' | 'exact-route' | 'prefix-route' | 'fallback-owner'
  contributionId?: string
}

export interface HookRegistration {
  hook: string
  source: string
  packageName?: string
  version?: string
  evidenceKind: EvidenceKind
}

export interface PatchWrite {
  path: string
  source: string
  packageName?: string
  version?: string
  evidenceKind: EvidenceKind
}

export interface RuntimeFacts {
  dsh?: string
  cordis?: string
  node?: string
  platform?: string
}

export interface PeerRequirement {
  packageName: string
  source: string
  evidenceKind: EvidenceKind
  dsh?: string
  cordis?: string
  node?: string
}

export interface BundleFact {
  name: string
  version?: string
  requestedSpec?: string
  source: string
  evidenceKind: EvidenceKind
  gitRef?: string
  integrity?: string
  repository?: string
  modifiedAt?: string
  profile?: string
}

export interface PlatformRequirement {
  packageName: string
  source: string
  evidenceKind: EvidenceKind
  supported: readonly string[]
}

export interface CompositionModel {
  profileDir: string
  metadataCoverage?: MetadataCoverage
  rows: readonly CompositionRow[]
  adapterDiagnostics: readonly Diagnostic[]
  uiClaims?: readonly UiClaim[]
  hooks?: readonly HookRegistration[]
  patchWrites?: readonly PatchWrite[]
  runtime?: RuntimeFacts
  peerRequirements?: readonly PeerRequirement[]
  bundles?: readonly BundleFact[]
  installedPackages?: readonly InstalledPackageFact[]
  platforms?: readonly PlatformRequirement[]
  evidenceMode?: EvidenceMode
  runtimeObservation?: RuntimeObservation
}

export interface AnalysisReport {
  schemaVersion: 1
  evidenceSchemaVersion: 2
  generatedAt: string
  profileDir: string
  evidenceMode: EvidenceMode | LegacyEvidenceMode
  runtimeObserved: boolean
  metadataCoverage?: MetadataCoverage
  unverifiedFindings: readonly string[]
  diagnostics: readonly Diagnostic[]
  /** Absent on legacy reports written before the 0.3 composition facts contract. */
  compositionFacts?: CompositionFacts
}

export interface ResolvedCompositionProvider {
  resolve(input: ProfileInput): Promise<readonly CompositionRow[]>
}
