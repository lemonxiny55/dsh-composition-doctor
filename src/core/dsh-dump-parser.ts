import { parse } from 'yaml'

import type { CompositionRow, Diagnostic } from './types.js'

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function rowsFrom(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const object = record(value)
  if (object === undefined) return []
  for (const key of ['rows', 'plugins', 'composition']) {
    if (Array.isArray(object[key])) return object[key] as unknown[]
  }
  const config = record(object.config)
  if (config !== undefined && Array.isArray(config.plugins)) return config.plugins
  return []
}

function configKeys(value: unknown): readonly string[] | undefined {
  const object = record(value)
  return object === undefined ? undefined : Object.keys(object).sort()
}

function provenanceByRow(stdout: string): readonly (string | undefined)[] {
  const result: string[] = []
  let current: string | undefined
  for (const line of stdout.split(/\r?\n/)) {
    const comment = line.match(/^\s*#\s*==\s*(.+?)\s*$/)
    if (comment !== null) {
      current = comment[1]
      continue
    }
    if (current !== undefined && /^-\s/.test(line)) result.push(current)
  }
  return result
}

function provenanceParts(label: string | undefined): { source?: string; provenance?: readonly string[] } {
  if (label === undefined) return {}
  const parts = label.split(/,\s*patched by\s+/)
  const source = parts[0]
  const patches = parts.slice(1).flatMap((part) => part.split(/,\s+/)).filter(Boolean)
  return { source, provenance: [source, ...patches] }
}

export interface ParsedDump {
  rows: readonly CompositionRow[]
  diagnostics: readonly Diagnostic[]
}

export function parseDshDump(stdout: string, stderr = ''): ParsedDump {
  let parsed: unknown
  try {
    try {
      parsed = JSON.parse(stdout)
    } catch {
      parsed = parse(stdout, {
        customTags: [
          { tag: 'tag:yaml.org,2002:js', resolve: (value: string) => value },
          { tag: 'tag:yaml.org,2002:js/function', resolve: (value: string) => value }
        ]
      })
    }
  } catch (error: unknown) {
    return {
      rows: [],
      diagnostics: [{
        id: 'composed-dump-parse-failed', severity: 'warning', title: 'Composed DSH dump could not be parsed',
        evidence: [{ source: '<DSH dump>', detail: error instanceof Error ? error.message : String(error), evidenceKind: 'composed' }],
        explanation: 'The public dump-config command returned output that was not valid JSON or YAML.',
        remediation: 'Use a verified DSH release whose public dump-config output is supported by this adapter.'
      }]
    }
  }
  const provenanceHints = provenanceByRow(stdout)
  const legacyProvenanceHints = stdout.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*#\s*(?:source|from|file|layer)\s*[:=]\s*(.+?)\s*$/i)
    return match === null ? [] : [match[1]!]
  })
  const rawRows = rowsFrom(parsed)
  const seenIds = new Map<string, string | undefined>()
  const rows: CompositionRow[] = rawRows.flatMap((entry, index): CompositionRow[] => {
    const object = record(entry)
    if (object === undefined) return []
    const provenance = provenanceParts(typeof object.source === 'string' ? object.source : provenanceHints[index] ?? legacyProvenanceHints[index])
    const source = typeof object.source === 'string' ? object.source : provenance.source ?? '<DSH dump>'
    const config = object.config
    const explicitReplacement = object.replacement === true || object.overridden === true
    const row: CompositionRow = {
      ...(typeof object.id === 'string' ? { id: object.id } : {}),
      ...(typeof object.name === 'string' ? { name: object.name } : typeof object.plugin === 'string' ? { name: object.plugin } : {}),
      source,
      ...(config === undefined ? {} : { config, ...(configKeys(config) === undefined ? {} : { configKeys: configKeys(config) }) }),
      evidenceKind: 'composed',
      ...(typeof object.layer === 'string' ? { layer: object.layer } : {}),
      ...(typeof object.layerOrder === 'number' ? { layerOrder: object.layerOrder } : {}),
      ...(provenance.provenance === undefined ? {} : { provenance: provenance.provenance }),
      ...(explicitReplacement || (provenance.provenance !== undefined && provenance.provenance.length > 1) || (typeof object.id === 'string' && seenIds.has(object.id) && seenIds.get(object.id) !== source)
        ? { replacement: true, replacementBasis: explicitReplacement ? 'observed' as const : 'derived' as const }
        : {})
    }
    if (row.id !== undefined) seenIds.set(row.id, row.source)
    return [row]
  })
  const diagnostics: Diagnostic[] = []
  const unmatched = stderr.match(/(?:patch[^\r\n]*(?:unmatched|unknown|not found)|(?:unmatched|unknown|not found)[^\r\n]*(?:patch|row|target))[^\r\n]*/gi) ?? []
  for (const detail of unmatched) diagnostics.push({
    id: 'unmatched-patch-target', severity: 'warning', title: 'Resolved patch target did not match a row',
    evidence: [{ source: '<DSH stderr>', detail, evidenceKind: 'composed' }],
    explanation: 'The public DSH dump reported a patch target that did not match a resolved row.',
    remediation: 'Verify the patch row id against the selected bundle/profile composition.'
  })
  return { rows, diagnostics }
}
