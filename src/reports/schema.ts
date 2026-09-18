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
