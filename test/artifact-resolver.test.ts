import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

import { resolveCandidateArtifact } from '../src/core/preflight/candidate-artifact-resolver.js'
import { resolveDshArtifact } from '../src/core/preflight/artifact-resolver.js'

const temporaryDirectories: string[] = []

function packageTarball(manifest: Record<string, unknown>): Buffer {
  const content = Buffer.from(JSON.stringify(manifest), 'utf8')
  const header = Buffer.alloc(512)
  header.write('package/package.json', 0, 'utf8')
  header.write(`${content.length.toString(8).padStart(11, '0')} `, 124, 'ascii')
  header[156] = 48
  const padded = Buffer.alloc(Math.ceil(content.length / 512) * 512)
  content.copy(padded)
  return gzipSync(Buffer.concat([header, padded, Buffer.alloc(1024)]))
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('offline artifact resolution', () => {
  test('honors explicit binary and package directory priority without executing lifecycle scripts', async () => {
    const root = await mkdtemp(join(process.cwd(), '.tmp-artifact-resolver-'))
    temporaryDirectories.push(root)
    const binary = join(root, 'dsh.mjs')
    const packageDirectory = join(root, 'dsh-package')
    await mkdir(packageDirectory, { recursive: true })
    await writeFile(binary, 'export {}\n')
    await writeFile(join(packageDirectory, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh', version: '0.1.5-rc.1', bin: { dsh: 'bin/dsh.js' } }))

    await expect(resolveDshArtifact({ targetDsh: '0.1.5-rc.1', dshBin: binary, dshPackage: packageDirectory, online: false })).resolves.toMatchObject({ kind: 'dsh-bin', path: binary, targetVersionVerified: false })
    await expect(resolveDshArtifact({ targetDsh: '0.1.5-rc.1', dshPackage: packageDirectory, online: false })).resolves.toMatchObject({ kind: 'dsh-package', targetVersionVerified: true, source: 'explicit-local' })
  })

  test('reports an invalid local tarball as unavailable instead of pretending it was verified', async () => {
    const root = await mkdtemp(join(process.cwd(), '.tmp-artifact-resolver-tarball-'))
    temporaryDirectories.push(root)
    const tarball = join(root, 'dsh-0.1.5-rc.1.tgz')
    await writeFile(tarball, 'not a tarball\n')
    await expect(resolveDshArtifact({ targetDsh: '0.1.5-rc.1', dshPackage: tarball, online: false })).resolves.toMatchObject({ kind: 'unavailable', source: 'unavailable' })
  })

  test('reports unavailable instead of pretending online resolution happened', async () => {
    await expect(resolveDshArtifact({ targetDsh: '0.1.5-rc.1', dshBin: join(process.cwd(), 'missing-dsh'), online: false })).resolves.toMatchObject({ kind: 'unavailable', targetVersionVerified: false })
  })

  test('uses an exact package-manager cache tarball before online resolution', async () => {
    const root = await mkdtemp(join(process.cwd(), '.tmp-package-cache-'))
    const cache = join(root, 'store')
    temporaryDirectories.push(root)
    await mkdir(cache, { recursive: true })
    await writeFile(join(cache, 'dsh-0.1.5-rc.1.tgz'), packageTarball({ name: '@deepseek-ai/dsh', version: '0.1.5-rc.1', bin: { dsh: 'bin/dsh.js' } }))
    await expect(resolveDshArtifact({ targetDsh: '0.1.5-rc.1', online: true, packageManagerCacheDirs: [cache] })).resolves.toMatchObject({ kind: 'dsh-tarball', source: 'package-manager-cache', targetVersionVerified: true, resolvedVersion: '0.1.5-rc.1' })
  })
})

test('candidate resolver inspects only an exact local node_modules artifact', async () => {
  const root = await mkdtemp(join(process.cwd(), '.tmp-candidate-resolver-'))
  temporaryDirectories.push(root)
  await mkdir(join(root, 'node_modules', 'candidate-plugin'), { recursive: true })
  await writeFile(join(root, 'node_modules', 'candidate-plugin', 'package.json'), JSON.stringify({ name: 'candidate-plugin', version: '2.0.0', scripts: { install: 'must-not-run' } }))

  await expect(resolveCandidateArtifact(root, 'candidate-plugin@2.0.0', false)).resolves.toMatchObject({ status: 'resolved', artifact: { installedVersion: '2.0.0', lifecycleScripts: ['install'] } })
  await expect(resolveCandidateArtifact(root, 'missing-plugin@1.0.0', false)).resolves.toMatchObject({ status: 'unavailable' })
})
