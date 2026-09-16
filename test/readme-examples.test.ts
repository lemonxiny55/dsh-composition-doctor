import { access, readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'

test('README examples use the four command names', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  for (const command of ['scan', 'snapshot', 'diff', 'preflight']) expect(readme).toContain(`dsh-doctor ${command}`)
})

test('README badges and bilingual documentation have matching release sections', async () => {
  const [readme, chineseReadme, ciWorkflow] = await Promise.all([
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
    readFile(new URL('../README.zh.md', import.meta.url), 'utf8'),
    readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  ])

  expect(readme).toContain('actions/workflows/ci.yml/badge.svg')
  await expect(access(new URL('../.github/workflows/ci.yml', import.meta.url))).resolves.toBeUndefined()
  expect(ciWorkflow).toContain('uses: pnpm/action-setup@v4')
  expect(ciWorkflow).not.toMatch(/uses: pnpm\/action-setup@v4\s+with:\s+version:/)

  for (const heading of ['## Reports and evidence boundaries', '## Safety and privacy', '## Support and limitations', '## Development']) {
    expect(readme).toContain(heading)
  }
  for (const heading of ['## 报告与证据边界', '## 安全与隐私', '## 支持范围与限制', '## 开发']) {
    expect(chineseReadme).toContain(heading)
  }
})
