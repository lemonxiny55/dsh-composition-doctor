export type SmokeOutcome = 'pass' | 'warning' | 'fail' | 'not-run'
export interface SmokeResult { outcome: SmokeOutcome; detail: string }

export const runtimeNotRun: SmokeResult = { outcome: 'not-run', detail: 'Third-party runtime execution requires an explicit supported isolation backend; a temporary directory is not a security sandbox.' }
