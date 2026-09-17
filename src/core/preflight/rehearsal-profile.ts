import { mkdir } from 'node:fs/promises'

/** Creates only the directory boundary; callers must copy allow-listed files through AST redaction. */
export async function createRehearsalDirectory(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true })
  return directory
}
