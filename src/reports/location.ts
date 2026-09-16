import { resolve } from 'node:path'

/**
 * Relative to the DSH host process working directory. This directory is owned
 * by the doctor plugin and is deliberately separate from a scanned profile.
 */
export const defaultReportDirectory = '.dsh-composition-doctor/reports'

export function resolveReportDirectory(reportDir: string = defaultReportDirectory): string {
  return resolve(reportDir)
}
