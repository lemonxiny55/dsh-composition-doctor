import { cp, lstat, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { resolveComposition } from '../src/core/composition-adapter.js'
import { readProfile } from '../src/core/profile-reader.js'
import { redact } from '../src/core/redaction.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'healthy')
const temporaryDirectories: string[] = []

async function copyHealthyProfile(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-profile-reader-'))
  temporaryDirectories.push(directory)
  await cp(fixtureRoot, directory, { recursive: true, force: true })
  return directory
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('readProfile', () => {
  it('reads only root-level allow-listed files and excludes .env', async () => {
    const profileDir = await copyHealthyProfile()

    const profile = await readProfile({ profileDir })

    expect(profile.files.map((file) => file.relativePath).sort()).toEqual(['cordis.yml', 'package.json'])
    expect(profile.files.map((file) => file.text).join('\n')).not.toContain('do-not-leak')
    expect(profile.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true)
    expect(profile.metadataCoverage).toMatchObject({ mode: 'allow-listed-root-metadata' })
    expect(profile.metadataCoverage.unscannedSurfaces).toContain('nested plugin manifests and bundle metadata')
  })

  it('skips an allow-listed symlink that resolves outside the profile root', async (context) => {
    const profileDir = await copyHealthyProfile()
    const outsideFile = join(tmpdir(), `dsh-outside-${Date.now()}.json`)
    await writeFile(outsideFile, '{"outside":true}', 'utf8')
    temporaryDirectories.push(outsideFile)
    await rm(join(profileDir, 'package.json'))
    try {
      await symlink(outsideFile, join(profileDir, 'package.json'))
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        context.skip('Windows file-symlink creation is unavailable to this test process')
        return
      }
      throw error
    }

    const profile = await readProfile({ profileDir })

    expect(profile.files.map((file) => file.relativePath)).not.toContain('package.json')
    await expect(lstat(join(profileDir, 'package.json'))).resolves.toMatchObject({ isSymbolicLink: expect.any(Function) })
  })

  it('skips an allow-listed symlink even when it resolves to an in-root .env', async (context) => {
    const profileDir = await copyHealthyProfile()
    await rm(join(profileDir, 'package.json'))
    try {
      await symlink(join(profileDir, '.env'), join(profileDir, 'package.json'))
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        context.skip('Windows file-symlink creation is unavailable to this test process')
        return
      }
      throw error
    }

    const profile = await readProfile({ profileDir })

    expect(profile.files.map((file) => file.relativePath)).not.toContain('package.json')
    expect(profile.files.map((file) => file.text).join('\n')).not.toContain('do-not-leak')
  })
})

describe('redact', () => {
  it('removes nested secret properties without mutating the input', () => {
    const input = {
      apiToken: 'do-not-leak',
      nested: { password: 'do-not-leak', visible: 'keep-me' },
      items: [{ Authorization: 'do-not-leak' }, 'plain']
    }

    expect(redact(input)).toEqual({
      apiToken: '[REDACTED]',
      nested: { password: '[REDACTED]', visible: 'keep-me' },
      items: [{ Authorization: '[REDACTED]' }, 'plain']
    })
    expect(input).toEqual({
      apiToken: 'do-not-leak',
      nested: { password: 'do-not-leak', visible: 'keep-me' },
      items: [{ Authorization: 'do-not-leak' }, 'plain']
    })
  })
})

describe('resolveComposition', () => {
  it('extracts a static row from healthy YAML and warns that runtime composition needs a provider', async () => {
    const input = await readProfile({ profileDir: await copyHealthyProfile() })

    const composition = await resolveComposition(input)

    expect(composition.rows).toEqual([
      {
        id: 'healthy-plugin',
        name: 'Healthy Plugin',
        config: { enabled: true },
        source: 'cordis.yml',
        evidenceKind: 'static'
      }
    ])
    expect(composition.adapterDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'runtime-composition-unavailable', severity: 'warning' })
    ]))
  })

  it('uses cloned provider rows marked resolved instead of static files', async () => {
    const input = await readProfile({ profileDir: await copyHealthyProfile() })
    const providerRow = {
      id: 'runtime-plugin',
      source: 'provider',
      config: { nested: { enabled: true } },
      evidenceKind: 'static' as const
    }

    const composition = await resolveComposition(input, { resolve: async () => [providerRow] })

    expect(composition.rows).toEqual([{
      id: 'runtime-plugin',
      source: 'provider',
      config: { nested: { enabled: true } },
      evidenceKind: 'resolved'
    }])
    expect(composition.rows[0]).not.toBe(providerRow)
    expect(composition.rows[0].config).not.toBe(providerRow.config)
    ;((composition.rows[0].config as { nested: { enabled: boolean } }).nested.enabled) = false
    expect(providerRow.config.nested.enabled).toBe(true)
    expect(providerRow.evidenceKind).toBe('static')
    expect(composition.adapterDiagnostics).toEqual([])
    expect(composition.evidenceMode).toBe('resolved')
  })

  it('accepts provider rows with function values while detaching plain nested config', async () => {
    const input = await readProfile({ profileDir: await copyHealthyProfile() })
    const callback = () => 'provider-owned'
    const providerRow = {
      id: 'runtime-plugin-with-function',
      source: 'provider',
      config: { nested: { enabled: true }, callback },
      evidenceKind: 'static' as const
    }

    const composition = await resolveComposition(input, { resolve: async () => [providerRow] })

    expect(composition.rows[0].config).toEqual({ nested: { enabled: true }, callback })
    expect((composition.rows[0].config as { nested: { enabled: boolean } }).nested).not.toBe(providerRow.config.nested)
    ;((composition.rows[0].config as { nested: { enabled: boolean } }).nested.enabled) = false
    expect(providerRow.config.nested.enabled).toBe(true)
  })

  it('preserves an own __proto__ config property without prototype pollution', async () => {
    const input = await readProfile({ profileDir: await copyHealthyProfile() })
    const config = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>
    const providerRow = { id: 'proto-plugin', source: 'provider', config, evidenceKind: 'static' as const }

    const composition = await resolveComposition(input, { resolve: async () => [providerRow] })
    const clonedConfig = composition.rows[0].config as Record<string, unknown>

    expect(Object.getPrototypeOf(clonedConfig)).toBeNull()
    expect(Object.hasOwn(clonedConfig, '__proto__')).toBe(true)
    expect(clonedConfig.__proto__).toEqual({ polluted: true })
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })
})
