import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('DSH client bundle', () => {
  it('registers with the DSH browser module loader', async () => {
    const bundle = await readFile(new URL('../dist/client.js', import.meta.url), 'utf8')
    expect(bundle).toContain('window.__ModuleLoader__.load')
    expect(bundle).toContain('id: "dsh-composition-doctor"')
    expect(bundle).toContain('factory: (require)')
  })
})
