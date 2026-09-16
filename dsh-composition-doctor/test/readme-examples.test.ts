import { readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'

test('README examples use the four command names', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  for (const command of ['scan', 'snapshot', 'diff', 'preflight']) expect(readme).toContain(`dsh-doctor ${command}`)
})
