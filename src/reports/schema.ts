/** JSON Schema for the report wire format. Report schemaVersion remains 1;
 * evidenceSchemaVersion is additive and separates evidence capability names. */
export const analysisReportJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['schemaVersion', 'evidenceSchemaVersion', 'generatedAt', 'profileDir', 'evidenceMode', 'runtimeObserved', 'unverifiedFindings', 'diagnostics'],
  properties: {
    schemaVersion: { const: 1 },
    evidenceSchemaVersion: { const: 2 },
    generatedAt: { type: 'string' },
    profileDir: { type: 'string' },
    evidenceMode: { enum: ['static', 'composed', 'runtime-observed', 'mixed'] },
    runtimeObserved: { type: 'boolean' },
    unverifiedFindings: { type: 'array', items: { type: 'string' } },
    compositionFacts: {
      type: 'object',
      required: ['schemaVersion', 'evidenceMode', 'nodes', 'edges', 'rows', 'unknownSurfaces'],
      properties: {
        schemaVersion: { const: 1 },
        evidenceMode: { enum: ['static', 'composed', 'runtime-observed', 'mixed'] },
        nodes: { type: 'array', items: {
          type: 'object', required: ['id', 'entity', 'label'],
          properties: {
            id: { type: 'string' }, entity: { enum: ['bundle', 'source', 'layer', 'row', 'diagnostic'] }, label: { type: 'string' },
            source: { type: 'string' }, layer: { type: 'string' }, layerOrder: { type: 'number' },
            packageName: { type: 'string' }, packageVersion: { type: 'string' },
            evidenceMode: { enum: ['static', 'composed', 'runtime-observed'] }, rowKey: { type: 'string' }, diagnosticId: { type: 'string' }
          }, additionalProperties: false
        } },
        edges: { type: 'array', items: {
          type: 'object', required: ['from', 'to', 'relation', 'basis', 'evidenceMode'],
          properties: {
            from: { type: 'string' }, to: { type: 'string' },
            relation: { enum: ['introduced', 'patched-by', 'source-of', 'contains', 'diagnosed-by', 'package-source'] },
            basis: { enum: ['observed', 'derived'] }, evidenceMode: { enum: ['static', 'composed', 'runtime-observed'] }
          }, additionalProperties: false
        } },
        rows: { type: 'array', items: {
          type: 'object', required: ['entity', 'key', 'source', 'sourceBasis', 'provenance', 'replacement', 'configKeys', 'configKeysBasis', 'evidenceMode', 'relatedDiagnosticIds', 'unknown'],
          properties: {
            entity: { const: 'row' }, key: { type: 'string' }, id: { type: 'string' }, name: { type: 'string' },
            source: { type: 'string' }, sourceBasis: { const: 'observed' }, layer: { type: 'string' }, layerOrder: { type: 'number' },
            provenance: { type: 'array', items: { type: 'object', required: ['source', 'sourceBasis', 'relation', 'basis'], properties: { source: { type: 'string' }, sourceBasis: { const: 'observed' }, relation: { enum: ['introduced', 'patched-by'] }, basis: { enum: ['observed', 'derived'] } }, additionalProperties: false } },
            replacement: { type: 'object', required: ['state', 'basis'], properties: { state: { enum: ['yes', 'no', 'unknown'] }, basis: { enum: ['observed', 'derived', 'unknown'] } }, additionalProperties: false },
            configKeys: { type: 'array', items: { type: 'string' } }, configKeysBasis: { enum: ['observed', 'derived'] }, evidenceMode: { enum: ['static', 'composed', 'runtime-observed'] },
            packageName: { type: 'string' }, packageVersion: { type: 'string' }, relatedDiagnosticIds: { type: 'array', items: { type: 'string' } },
            removedConfigKeys: { type: 'array', items: { type: 'string' } }, unknown: { type: 'array', items: { type: 'string' } }
          }, additionalProperties: false
        } },
        unknownSurfaces: { type: 'array', items: { type: 'string' } }
      }, additionalProperties: false
    },
    diagnostics: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'severity', 'title', 'evidence', 'explanation', 'remediation'],
        properties: {
          id: { type: 'string' },
          severity: { enum: ['info', 'warning', 'error'] },
          title: { type: 'string' },
          explanation: { type: 'string' },
          remediation: { type: 'string' },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              required: ['source', 'detail', 'evidenceKind'],
              properties: {
                source: { type: 'string' },
                detail: { type: 'string' },
                evidenceKind: { enum: ['static', 'composed', 'runtime-observed'] },
                subject: { type: 'string' },
                packageName: { type: 'string' },
                version: { type: 'string' },
                severity: { enum: ['info', 'warning', 'error'] }
              },
              additionalProperties: false
            }
          }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: true
} as const
