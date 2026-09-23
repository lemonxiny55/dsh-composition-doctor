import { createHash } from 'node:crypto'
import { basename, isAbsolute, relative, win32 } from 'node:path'

import type {
  AnalysisReport, CompositionFacts, CompositionGraphEdge, CompositionGraphNode,
  CompositionModel, CompositionRowFact, Diagnostic, EvidenceKind
} from './types.js'

const unknownSurfaces = [
  'route ownership: not observed / not modelled',
  'slot ownership: not observed / not modelled',
  'runtime hook ownership: not observed / not modelled',
  'arbitrary dependencies: not modelled',
  'possible dependents: not modelled'
] as const

function stableKey(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

/** Replace profile and external absolute paths before any composition fact is serialized. */
export function normalizeCompositionSource(source: string, profileDir: string): string {
  if (source.startsWith('<') && source.endsWith('>')) return source
  const windowsAbsolute = /^[a-z]:[\\/]/i.test(source) || source.startsWith('\\\\')
  const posixAbsolute = source.startsWith('/')
  if (!windowsAbsolute && !posixAbsolute && !isAbsolute(source)) return source.replaceAll('\\', '/')

  try {
    if (windowsAbsolute || /^[a-z]:[\\/]/i.test(profileDir)) {
      const relativePath = win32.relative(win32.resolve(profileDir), win32.resolve(source)).replaceAll('\\', '/')
      if (relativePath === '') return '<PROFILE>'
      if (relativePath !== '..' && !relativePath.startsWith('../') && !/^[a-z]:/i.test(relativePath)) return `<PROFILE>/${relativePath}`
    } else {
      const relativePath = relative(profileDir, source).replaceAll('\\', '/')
      if (relativePath === '') return '<PROFILE>'
      if (relativePath !== '..' && !relativePath.startsWith('../') && !isAbsolute(relativePath)) return `<PROFILE>/${relativePath}`
    }
  } catch { /* malformed paths are reduced to a basename below */ }
  return `<EXTERNAL>/${basename(source.replaceAll('\\', '/'))}`
}

function rowConfigKeys(row: CompositionModel['rows'][number]): string[] {
  if (row.configKeys !== undefined) return [...new Set(row.configKeys)].sort()
  if (row.config !== null && typeof row.config === 'object' && !Array.isArray(row.config)) return Object.keys(row.config as Record<string, unknown>).sort()
  return []
}

function matchingPackages(model: CompositionModel, sources: readonly string[]): NonNullable<CompositionModel['installedPackages']>[number][] {
  const labels = new Set(sources)
  return (model.installedPackages ?? []).filter((fact) => labels.has(fact.name))
}

function relatedDiagnostics(row: CompositionModel['rows'][number], packageNames: readonly string[], diagnostics: readonly Diagnostic[], profileDir: string): string[] {
  const sources = new Set([row.source, ...(row.provenance ?? [])].map((source) => normalizeCompositionSource(source, profileDir)))
  return diagnostics.filter((diagnostic) => diagnostic.evidence.some((item) =>
    (row.id !== undefined && item.subject === row.id) ||
    packageNames.includes(item.packageName ?? '') ||
    sources.has(item.source)
    )).map((item) => item.id).sort()
}

export function buildCompositionFacts(model: CompositionModel, diagnostics: readonly Diagnostic[]): CompositionFacts {
  const nodes = new Map<string, CompositionGraphNode>()
  const edgeMap = new Map<string, CompositionGraphEdge>()
  const rows: CompositionRowFact[] = []
  const packages = model.installedPackages ?? []
  const reportMode = model.evidenceMode ?? 'static'

  const addNode = (node: CompositionGraphNode) => nodes.set(node.id, node)
  const addEdge = (edge: CompositionGraphEdge) => edgeMap.set(`${edge.from}\0${edge.relation}\0${edge.to}`, edge)

  for (const packageFact of packages) {
    const bundleId = `bundle:${encodeURIComponent(packageFact.name)}`
    addNode({ id: bundleId, entity: 'bundle', label: packageFact.name, source: normalizeCompositionSource(packageFact.packageJsonSource, model.profileDir), packageName: packageFact.name, ...(packageFact.installedVersion === undefined ? {} : { packageVersion: packageFact.installedVersion }), evidenceMode: 'static' })
  }

  for (const [index, row] of model.rows.entries()) {
    const rowIdentity = row.id ?? row.name ?? `${normalizeCompositionSource(row.source, model.profileDir)}:${index}`
    const rowKey = `row:${stableKey(`${rowIdentity}|${normalizeCompositionSource(row.source, model.profileDir)}|${row.layer ?? ''}|${row.layerOrder ?? index}`)}`
    const chain = row.provenance === undefined ? [] : [...row.provenance]
    const chainSources = chain.map((source) => normalizeCompositionSource(source, model.profileDir))
    const source = normalizeCompositionSource(row.source, model.profileDir)
    const directPackages = matchingPackages(model, chain.length > 0 ? chain : [row.source])
    const associatedPackage = directPackages.length === 1 ? directPackages[0] : undefined
    const replacement = row.replacement === true && row.replacementBasis !== 'derived'
      ? { state: 'yes' as const, basis: 'observed' as const }
      : row.replacement === true
        ? { state: 'unknown' as const, basis: 'unknown' as const }
      : row.replacement === false
        ? { state: 'no' as const, basis: 'observed' as const }
        : { state: 'unknown' as const, basis: 'unknown' as const }

    const unknown: string[] = []
    if (chain.length === 0) unknown.push('provenance chain is unavailable')
    if (row.layer === undefined) unknown.push('layer is unknown')
    if (row.replacement === true) unknown.push(row.replacementBasis !== 'derived'
      ? 'field-level owner and prior config values are unknown'
      : 'source chain indicates patching, but whole-row/config replacement, removed keys, and field owners are unknown')
    if (row.evidenceKind === 'static') unknown.push('final composed row is unknown; this is a static declaration')
    if (model.runtimeObservation?.observed !== true) unknown.push('runtime behavior was not observed; runtime-dependent values remain unknown/not-run')

    const provenance = chain.length === 0
      ? []
      : chain.map((chainSource, chainIndex) => ({
        source: chainSources[chainIndex]!,
        sourceBasis: 'observed' as const,
        relation: (chainIndex === 0 ? 'introduced' : 'patched-by') as 'introduced' | 'patched-by',
        basis: 'derived' as const
      }))
    const fact: CompositionRowFact = {
      entity: 'row', key: rowKey,
      ...(row.id === undefined ? {} : { id: row.id }),
      ...(row.name === undefined ? {} : { name: row.name }),
      source,
      sourceBasis: 'observed',
      ...(row.layer === undefined ? {} : { layer: row.layer }),
      ...(row.layerOrder === undefined ? {} : { layerOrder: row.layerOrder }),
      provenance,
      replacement,
      configKeys: rowConfigKeys(row),
      configKeysBasis: row.configKeys === undefined ? 'derived' : 'observed',
      evidenceMode: row.evidenceKind,
      ...(associatedPackage === undefined ? {} : { packageName: associatedPackage.name, ...(associatedPackage.installedVersion === undefined ? {} : { packageVersion: associatedPackage.installedVersion }) }),
      relatedDiagnosticIds: relatedDiagnostics(row, directPackages.map((item) => item.name), diagnostics, model.profileDir),
      unknown: [...new Set(unknown)].sort()
    }
    rows.push(fact)
    addNode({ id: rowKey, entity: 'row', label: row.id ?? row.name ?? 'anonymous row', source, ...(row.layer === undefined ? {} : { layer: row.layer }), ...(row.layerOrder === undefined ? {} : { layerOrder: row.layerOrder }), ...(fact.packageName === undefined ? {} : { packageName: fact.packageName }), ...(fact.packageVersion === undefined ? {} : { packageVersion: fact.packageVersion }), evidenceMode: row.evidenceKind, rowKey })

    if (row.layer !== undefined) {
      const layerId = `layer:${stableKey(`${row.layer}:${row.layerOrder ?? ''}`)}`
      addNode({ id: layerId, entity: 'layer', label: row.layer, layer: row.layer, ...(row.layerOrder === undefined ? {} : { layerOrder: row.layerOrder }), evidenceMode: row.evidenceKind })
      addEdge({ from: layerId, to: rowKey, relation: 'contains', basis: 'observed', evidenceMode: row.evidenceKind })
    }

    const linkSources = chain.length === 0 ? [row.source] : chain
    linkSources.forEach((label, chainIndex) => {
      const normalized = normalizeCompositionSource(label, model.profileDir)
      const matched = packages.filter((pkg) => pkg.name === label)
      const packageFact = matched.length === 1 ? matched[0] : undefined
      const sourceId = `source:${stableKey(normalized)}`
      addNode({ id: sourceId, entity: 'source', label: normalized, source: normalized, evidenceMode: row.evidenceKind })
      if (packageFact !== undefined) {
        const bundleId = `bundle:${encodeURIComponent(packageFact.name)}`
        addNode({ id: bundleId, entity: 'bundle', label: packageFact.name, source: normalizeCompositionSource(packageFact.packageJsonSource, model.profileDir), packageName: packageFact.name, ...(packageFact.installedVersion === undefined ? {} : { packageVersion: packageFact.installedVersion }), evidenceMode: 'static' })
        addEdge({ from: bundleId, to: sourceId, relation: 'package-source', basis: 'derived', evidenceMode: row.evidenceKind })
      }
      addEdge({
        from: sourceId,
        to: rowKey,
        relation: chain.length === 0 ? 'source-of' : chainIndex === 0 ? 'introduced' : 'patched-by',
        basis: chain.length === 0 ? 'observed' : 'derived',
        evidenceMode: row.evidenceKind
      })
    })

    for (const diagnosticId of fact.relatedDiagnosticIds) {
      const diagnostic = diagnostics.find((item) => item.id === diagnosticId)
      if (diagnostic === undefined) continue
      const diagnosticKey = `diagnostic:${diagnosticId}`
      addNode({ id: diagnosticKey, entity: 'diagnostic', label: diagnostic.title, diagnosticId, evidenceMode: diagnostic.evidence[0]?.evidenceKind ?? row.evidenceKind })
      addEdge({ from: rowKey, to: diagnosticKey, relation: 'diagnosed-by', basis: 'derived', evidenceMode: diagnostic.evidence[0]?.evidenceKind ?? row.evidenceKind })
    }
  }

  rows.sort((left, right) => left.key.localeCompare(right.key))
  return {
    schemaVersion: 1,
    evidenceMode: reportMode,
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edgeMap.values()].sort((left, right) => `${left.from}:${left.relation}:${left.to}`.localeCompare(`${right.from}:${right.relation}:${right.to}`)),
    rows,
    unknownSurfaces
  }
}

export function findCompositionRow(facts: CompositionFacts, id: string): CompositionRowFact | undefined {
  return facts.rows.find((row) => row.id === id)
}

export interface BundleImpact {
  schemaVersion: 1
  bundle: string
  evidenceMode: CompositionFacts['evidenceMode']
  rows: readonly CompositionRowFact[]
  edges: readonly CompositionGraphEdge[]
  diagnostics: readonly Diagnostic[]
  unknown: readonly string[]
}

export function compositionBundleImpact(report: AnalysisReport, name: string): BundleImpact {
  const facts = report.compositionFacts
  const rows = facts?.rows.filter((row) => row.packageName === name || row.provenance.some((item) => item.source === name)) ?? []
  const rowKeys = new Set(rows.map((row) => row.key))
  const sourceLabels = new Set(rows.flatMap((row) => row.provenance.map((item) => item.source)))
  const sourceIds = new Set(facts?.nodes.filter((node) => node.entity === 'source' && sourceLabels.has(node.label)).map((node) => node.id) ?? [])
  const bundleId = `bundle:${encodeURIComponent(name)}`
  const edges = facts?.edges.filter((edge) => rowKeys.has(edge.to) || rowKeys.has(edge.from) || sourceIds.has(edge.from) || sourceIds.has(edge.to) || edge.from === bundleId || edge.to === bundleId) ?? []
  const diagnosticIds = new Set(rows.flatMap((row) => row.relatedDiagnosticIds))
  const diagnostics = report.diagnostics.filter((diagnostic) =>
    diagnosticIds.has(diagnostic.id) || diagnostic.evidence.some((item) => item.packageName === name)
  )
  return {
    schemaVersion: 1,
    bundle: name,
    evidenceMode: facts?.evidenceMode ?? (report.evidenceMode === 'resolved' ? 'static' : report.evidenceMode),
    rows,
    edges,
    diagnostics,
    unknown: facts?.unknownSurfaces ?? [...unknownSurfaces]
  }
}

/** Normalize paths in diagnostic evidence before adding them to a report. */
export function redactDiagnosticPaths(diagnostics: readonly Diagnostic[], model: CompositionModel): Diagnostic[] {
  const knownPaths = [model.profileDir, ...(model.installedPackages ?? []).flatMap((fact) => [fact.packageJsonSource, ...(fact.bundlePatch === undefined ? [] : [fact.bundlePatch])])]
    .filter((value) => value.length > 0)
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    evidence: diagnostic.evidence.map((item) => {
      let detail = item.detail
      for (const path of knownPaths) {
        const normalized = path.replaceAll('\\', '/')
        detail = detail.replaceAll(path, normalizeCompositionSource(path, model.profileDir)).replaceAll(normalized, normalizeCompositionSource(path, model.profileDir))
      }
      return { ...item, source: normalizeCompositionSource(item.source, model.profileDir), detail }
    })
  }))
}

export function rowEvidence(row: CompositionModel['rows'][number]): { source: string; subject: string; detail: string; evidenceKind: EvidenceKind } {
  return {
    source: row.source,
    subject: row.id ?? row.name ?? 'anonymous-row',
    detail: `${row.layer === undefined ? 'resolved row' : `layer ${row.layer}`} ${row.replacement === true ? 'replaces the previous row' : 'declared'}`,
    evidenceKind: row.evidenceKind
  }
}
