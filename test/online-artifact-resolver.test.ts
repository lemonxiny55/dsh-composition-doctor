import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'

import { resolveDshArtifact } from '../src/core/preflight/artifact-resolver.js'
import { resolveCandidateArtifact } from '../src/core/preflight/candidate-artifact-resolver.js'

const onlineEnabled = process.env.DSH_DOCTOR_RUN_ONLINE_TESTS === '1'

test.skipIf(!onlineEnabled)('explicit online resolver downloads official DSH and candidate artifacts without installation or lifecycle execution', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-doctor-online-test-'))
  const profile = await mkdtemp(join(tmpdir(), 'dsh-doctor-online-profile-'))
  try {
    const dsh = await resolveDshArtifact({ targetDsh: '0.1.5-rc.1', online: true, cacheDir: root })
    expect(dsh).toMatchObject({ kind: 'dsh-tarball', source: 'npm-registry', targetVersionVerified: true, resolvedVersion: '0.1.5-rc.1', manifest: { version: '0.1.5-rc.1' } })
    expect(dsh.integrity).toMatch(/^sha512-/)
    expect(dsh.sha512).toMatch(/^[a-f0-9]{128}$/)
    expect(await readdir(root)).toEqual(expect.arrayContaining([expect.stringContaining('.tgz'), expect.stringContaining('.metadata.json')]))
    expect(await readdir(root)).not.toEqual(expect.arrayContaining(['node_modules', 'package-lock.json', 'pnpm-lock.yaml']))

    const candidate = await resolveCandidateArtifact(profile, '@deepseek-ai/dsh@0.1.5-rc.1', true, root)
    expect(candidate).toMatchObject({ status: 'resolved', artifact: { source: 'npm-registry', installedVersion: '0.1.5-rc.1', manifest: { version: '0.1.5-rc.1' } } })
    expect(candidate.artifact?.integrity).toMatch(/^sha512-/)
    expect(candidate.artifact?.sha512).toMatch(/^[a-f0-9]{128}$/)
    expect(await readdir(root)).not.toEqual(expect.arrayContaining(['node_modules', 'package-lock.json', 'pnpm-lock.yaml']))
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(profile, { recursive: true, force: true })
  }
  await expect(stat(root)).rejects.toThrow()
  await expect(stat(profile)).rejects.toThrow()
})
