export type Severity = 'info' | 'warning' | 'error'

export interface Evidence {
  source: string
  detail: string
  subject?: string
  packageName?: string
  version?: string
  evidenceKind?: EvidenceKind
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

export type EvidenceKind = 'static' | 'resolved'
export type EvidenceMode = 'static' | 'resolved' | 'mixed'

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
}

export interface CompositionRow {
  id?: string
  name?: string
  source: string
  config?: unknown
  evidenceKind: EvidenceKind
}

export interface UiClaim {
  kind: 'root-slot' | 'sidebar' | 'layout' | 'web-route'
  value: string
  source: string
  packageName?: string
  version?: string
  evidenceKind: EvidenceKind
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
  source: string
  evidenceKind: EvidenceKind
  gitRef?: string
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
  platforms?: readonly PlatformRequirement[]
  evidenceMode?: EvidenceMode
}

export interface AnalysisReport {
  schemaVersion: 1
  generatedAt: string
  profileDir: string
  evidenceMode: EvidenceMode
  metadataCoverage?: MetadataCoverage
  unverifiedFindings: readonly string[]
  diagnostics: readonly Diagnostic[]
}

export interface ResolvedCompositionProvider {
  resolve(input: ProfileInput): Promise<readonly CompositionRow[]>
}
