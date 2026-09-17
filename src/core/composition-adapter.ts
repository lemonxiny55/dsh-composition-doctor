import { parse } from 'yaml'

import { tryDshDump } from './dsh-dump-provider.js'
import type { BundleFact, CompositionModel, CompositionRow, Diagnostic, PeerRequirement, PlatformRequirement, ProfileFile, ProfileInput, ResolvedCompositionProvider } from './types.js'

function runtimeUnavailableDiagnostic(detail = 'Static YAML was read, but actual resolved composition requires a public provider.'): Diagnostic {
  return {
    id: 'runtime-composition-unavailable',
    severity: 'warning',
    title: 'Runtime composition is unavailable',
    evidence: [],
    explanation: detail,
    remediation: 'Install or explicitly provide a compatible public DSH dump provider; static findings remain bounded to the allow-listed metadata.'
  }
}

function parseFailedDiagnostic(file: ProfileFile, error: unknown): Diagnostic {
  return {
    id: 'composition-parse-failed',
    severity: 'warning',
    title: 'Composition YAML could not be parsed',
    evidence: [{ source: file.relativePath, detail: error instanceof Error ? error.message : String(error), evidenceKind: 'static' }],
    explanation: 'This static composition source was skipped because its YAML is invalid.',
    remediation: 'Correct the YAML syntax and run the static analysis again.'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function parseYamlValue(text: string): unknown {
  return parse(text, {
    customTags: [
      { tag: 'tag:yaml.org,2002:js', resolve: (value: string) => value },
      { tag: 'tag:yaml.org,2002:js/function', resolve: (value: string) => value }
    ]
  })
}

function cloneProviderValue(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (value === null || typeof value !== 'object') return value
  const existing = seen.get(value)
  if (existing !== undefined) return existing

  if (Array.isArray(value)) {
    const copy: unknown[] = []
    seen.set(value, copy)
    for (const item of value) copy.push(cloneProviderValue(item, seen))
    return copy
  }

  if (!isPlainObject(value)) return value
  const copy: Record<string, unknown> = Object.create(null)
  seen.set(value, copy)
  for (const property of Object.keys(value)) {
    copy[property] = cloneProviderValue(value[property], seen)
  }
  return copy
}

function staticRows(file: ProfileFile): CompositionRow[] {
  const parsed: unknown = parseYamlValue(file.text)
  const entries: unknown = Array.isArray(parsed) ? parsed : isRecord(parsed) ? parsed.plugins : undefined
  if (!Array.isArray(entries)) return []

  return entries.flatMap((entry): CompositionRow[] => {
    if (!isRecord(entry)) return []
    const row: CompositionRow = { source: file.relativePath, evidenceKind: 'static' }
    if (typeof entry.id === 'string') row.id = entry.id
    if (typeof entry.name === 'string') row.name = entry.name
    if ('config' in entry) row.config = entry.config
    return [row]
  })
}

function inventoryFacts(input: ProfileInput): Pick<CompositionModel, 'bundles' | 'peerRequirements' | 'platforms'> {
  const bundles: BundleFact[] = []
  const peerRequirements: PeerRequirement[] = []
  const platforms: PlatformRequirement[] = []
  for (const fact of input.installedPackages) {
    bundles.push({
      name: fact.name,
      source: fact.packageJsonSource,
      evidenceKind: 'static',
      ...(fact.requestedSpec === undefined ? {} : { requestedSpec: fact.requestedSpec }),
      ...(fact.installedVersion === undefined ? {} : { version: fact.installedVersion }),
      ...(fact.gitRef === undefined ? {} : { gitRef: fact.gitRef }),
      ...(fact.integrity === undefined ? {} : { integrity: fact.integrity }),
      ...(fact.repository === undefined ? {} : { repository: fact.repository }),
      ...(fact.modifiedAt === undefined ? {} : { modifiedAt: fact.modifiedAt })
    })
    if (fact.peerDsh !== undefined || fact.peerCordis !== undefined || fact.engineNode !== undefined) {
      peerRequirements.push({ packageName: fact.name, source: fact.packageJsonSource, evidenceKind: 'static', ...(fact.peerDsh === undefined ? {} : { dsh: fact.peerDsh }), ...(fact.peerCordis === undefined ? {} : { cordis: fact.peerCordis }), ...(fact.engineNode === undefined ? {} : { node: fact.engineNode }) })
    }
    if (fact.platform !== undefined && fact.platform.length > 0) platforms.push({ packageName: fact.name, source: fact.packageJsonSource, evidenceKind: 'static', supported: fact.platform })
  }
  return { bundles, peerRequirements, platforms }
}

export async function resolveComposition(input: ProfileInput, provider?: ResolvedCompositionProvider): Promise<CompositionModel> {
  if (provider) {
    const providedRows = await provider.resolve(input)
    return {
      profileDir: input.profileDir,
      rows: providedRows.map((row) => ({ ...(cloneProviderValue(row) as CompositionRow), evidenceKind: 'composed' })),
      adapterDiagnostics: [...input.inventoryDiagnostics], evidenceMode: 'composed', runtimeObservation: { observed: false, detail: 'A composition provider supplied a resolved tree; no runtime was started.' }, metadataCoverage: input.metadataCoverage, installedPackages: input.installedPackages
    }
  }

  const resolved = await tryDshDump(input)
  if (resolved !== undefined) {
    return {
      profileDir: input.profileDir,
      rows: resolved.rows,
      adapterDiagnostics: [...input.inventoryDiagnostics, ...resolved.diagnostics],
      evidenceMode: 'composed',
      runtimeObservation: { observed: false, detail: 'dump-config composes configuration without starting third-party runtime code.' },
      metadataCoverage: input.metadataCoverage,
      installedPackages: input.installedPackages,
      ...inventoryFacts(input)
    }
  }
  const rows: CompositionRow[] = []
  const facts = inventoryFacts(input)
  const adapterDiagnostics: Diagnostic[] = [...input.inventoryDiagnostics, runtimeUnavailableDiagnostic()]
  for (const file of input.files) {
    if (file.relativePath !== 'cordis.yml' && file.relativePath !== 'cordis.patch.yml') continue
    try {
      rows.push(...staticRows(file))
    } catch (error: unknown) {
      adapterDiagnostics.push(parseFailedDiagnostic(file, error))
    }
  }
  return { profileDir: input.profileDir, rows, ...facts, installedPackages: input.installedPackages, adapterDiagnostics, evidenceMode: 'static', runtimeObservation: { observed: false, detail: 'Only allow-listed static metadata was inspected.' }, metadataCoverage: input.metadataCoverage }
}
