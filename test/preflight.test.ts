import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { runPreflight } from '../src/core/preflight.js'

const fixture = join(process.cwd(), 'test', 'fixtures', 'preflight-real-profile')

async function fingerprintSentinel(): Promise<string> {
  return createHash('sha256').update(await readFile(join(fixture, 'sentinel.txt'))).digest('hex')
}

describe('isolated preflight', () => {
  test('leaves the selected profile and sentinel unchanged', async () => {
    const before = await fingerprintSentinel()
    const result = await runPreflight({
      profileDir: fixture,
      targetDsh: '0.1.0-rc.6',
      candidates: [],
      allowBuild: false,
      online: false
    })

    expect(result.outcome).not.toBe('fail')
    expect(await fingerprintSentinel()).toBe(before)
    expect(result.evidence).toContainEqual(expect.objectContaining({ subject: 'profile-unchanged' }))
  })

  test('emits a build plan and does not build without allow-build', async () => {
    const result = await runPreflight({
      profileDir: fixture,
      targetDsh: '0.1.0-rc.6',
      candidates: ['example-plugin@2.0.0'],
      allowBuild: false,
      online: false
    })

    expect(result.evidence).toContainEqual(expect.objectContaining({ subject: 'build-plan' }))
    expect(result.evidence).toContainEqual(expect.objectContaining({ subject: 'build-not-executed' }))
    expect(result.evidence.some((item) => item.detail.includes('example-plugin@2.0.0'))).toBe(false)
  })

  test('copies only redacted metadata into a kept temporary directory', async () => {
    const result = await runPreflight({
      profileDir: fixture,
      targetDsh: '0.1.0-rc.6',
      candidates: [],
      allowBuild: false,
      online: false,
      keepTemp: true
    })

    expect(result.tempDirectory).toBeDefined()
    const tempDirectory = result.tempDirectory as string
    const names = await readdir(tempDirectory)
    expect(names).toContain('cordis.yml')
    expect(names).toContain('package.json')
    expect(names).not.toContain('sentinel.txt')
    expect(await readFile(join(tempDirectory, 'cordis.yml'), 'utf8')).toContain('[REDACTED]')
    expect(await readFile(join(tempDirectory, 'cordis.yml'), 'utf8')).not.toContain('should-never-be-copied-in-plain-text')
  })
})
