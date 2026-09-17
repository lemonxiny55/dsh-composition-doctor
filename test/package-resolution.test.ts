import { describe, expect, test } from 'vitest'

import { evaluatePackageResolution } from '../src/core/preflight/package-resolution.js'

describe('package-resolution preflight', () => {
  const runtime = { dsh: '0.1.5-rc.2', cordis: '4.0.2', node: '24.19.0', platform: 'win32' }

  test('reports compatible package metadata and provenance without a security score', () => {
    const result = evaluatePackageResolution({
      packageName: 'fixture-plugin', requestedVersion: '1.2.3', resolvedVersion: '1.2.3', source: 'npm-registry', integrity: 'sha512-fixture', runtime,
      manifest: { peerDependencies: { '@deepseek-ai/dsh': '>=0.1.5-rc.1 <0.2.0', '@deepseek-ai/cordis': '^4.0.0' }, engines: { node: '>=20' }, os: ['win32'], cpu: ['x64'], gitHead: 'abc123' }
    })

    expect(result.status).toBe('compatible')
    expect(result.checks).toMatchObject({ version: 'pass', 'DSH peer': 'pass', 'Cordis peer': 'pass', 'Node engine': 'pass', OS: 'pass', CPU: 'pass' })
    expect(JSON.stringify(result)).not.toMatch(/score|safe/i)
  })

  test('distinguishes incompatible and unknown constraints', () => {
    const incompatible = evaluatePackageResolution({ packageName: 'bad-plugin', requestedVersion: '1.0.0', resolvedVersion: '1.0.0', source: 'profile-node_modules', runtime, manifest: { peerDependencies: { '@deepseek-ai/dsh': '<0.1.0' }, os: ['darwin'] } })
    const unknown = evaluatePackageResolution({ packageName: 'unknown-plugin', requestedVersion: '1.0.0', resolvedVersion: '1.0.0', source: 'profile-node_modules', runtime: { node: '24.19.0', platform: 'win32' }, manifest: { peerDependencies: { '@deepseek-ai/cordis': '>=4' } } })

    expect(incompatible.status).toBe('incompatible')
    expect(unknown.status).toBe('unknown')
  })

  test('reports unavailable when no artifact metadata exists', () => {
    expect(evaluatePackageResolution({ packageName: 'missing', requestedVersion: '1.0.0', source: 'unavailable', runtime }).status).toBe('unavailable')
  })
})
