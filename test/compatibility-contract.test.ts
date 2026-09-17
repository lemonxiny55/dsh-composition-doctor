import { expect, test } from 'vitest'
import { readFile } from 'node:fs/promises'

test('compatibility documentation does not claim an unverified release range', async () => {
  const text = await readFile('docs/compatibility.md', 'utf8')
  expect(text).toContain('Verified evidence in this repository')
  expect(text).toContain('Expected-compatible, not release-verified')
  expect(text).toContain('@deepseek-ai/dsh@0.1.5-rc.1')
  expect(text).toContain('@deepseek-ai/dsh@0.1.5-rc.2')
  expect(text).toContain('`verified`')
  expect(text).toContain('`expected-compatible`')
  expect(text).toContain('`unavailable`')
  expect(text).toContain('`incompatible`')
  expect(text).not.toContain('DSH: `>=0.1.0-rc.5 <0.2.0`')
})
