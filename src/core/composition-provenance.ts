import type { CompositionRow, Evidence } from './types.js'

export interface CompositionProvenance {
  source: string
  layer?: string
  layerOrder?: number
  replacedRowId?: string
  unmatchedPatchTarget?: string
}

export function rowEvidence(row: CompositionRow): Evidence {
  return {
    source: row.source,
    subject: row.id ?? row.name ?? 'anonymous-row',
    detail: `${row.layer === undefined ? 'resolved row' : `layer ${row.layer}`} ${row.replacement === true ? 'replaces the previous row' : 'declared'}`,
    evidenceKind: row.evidenceKind
  }
}
