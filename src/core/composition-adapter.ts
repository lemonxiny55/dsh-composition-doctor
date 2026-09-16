import { parse } from 'yaml'

import type { CompositionModel, CompositionRow, Diagnostic, ProfileFile, ProfileInput, ResolvedCompositionProvider } from './types.js'

function runtimeUnavailableDiagnostic(): Diagnostic {
  return {
    id: 'runtime-composition-unavailable',
    severity: 'warning',
    title: 'Runtime composition is unavailable',
    evidence: [],
    explanation: 'Static YAML was read, but actual resolved composition requires a public provider.',
    remediation: 'Supply a public ResolvedCompositionProvider to resolve runtime composition.'
  }
}

function parseFailedDiagnostic(file: ProfileFile, error: unknown): Diagnostic {
  return {
    id: 'composition-parse-failed',
    severity: 'warning',
    title: 'Composition YAML could not be parsed',
    evidence: [{ source: file.relativePath, detail: error instanceof Error ? error.message : String(error) }],
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
  const parsed: unknown = parse(file.text)
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

export async function resolveComposition(input: ProfileInput, provider?: ResolvedCompositionProvider): Promise<CompositionModel> {
  if (provider) {
    const providedRows = await provider.resolve(input)
    return {
      profileDir: input.profileDir,
      rows: providedRows.map((row) => ({ ...(cloneProviderValue(row) as CompositionRow), evidenceKind: 'resolved' })),
      adapterDiagnostics: []
    }
  }

  const rows: CompositionRow[] = []
  const adapterDiagnostics: Diagnostic[] = [runtimeUnavailableDiagnostic()]
  for (const file of input.files) {
    if (file.relativePath !== 'cordis.yml' && file.relativePath !== 'cordis.patch.yml') continue
    try {
      rows.push(...staticRows(file))
    } catch (error: unknown) {
      adapterDiagnostics.push(parseFailedDiagnostic(file, error))
    }
  }
  return { profileDir: input.profileDir, rows, adapterDiagnostics }
}
