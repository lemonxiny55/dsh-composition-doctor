import { expect, test } from 'vitest'

import { analyseComposition } from '../src/core/rules.js'
import { readProfile } from '../src/core/profile-reader.js'

const fixture = 'test/fixtures/healthy-single-plugin'

test('inventory follows dsh.profile.bundles and reads the installed manifest', async () => {
  const input = await readProfile({ profileDir: fixture })
  expect(input.installedPackages).toHaveLength(1)
  expect(input.installedPackages[0]).toMatchObject({
    name: '@fixture/healthy-bundle', requestedSpec: '1.2.3', installedVersion: '1.2.3',
    peerDsh: '>=0.1.0-rc.5 <0.2.0', engineNode: '>=20', integrity: 'sha512-fixture'
  })
  const report = analyseComposition({
    profileDir: input.profileDir, rows: [], adapterDiagnostics: input.inventoryDiagnostics,
    installedPackages: input.installedPackages, bundles: [{ name: '@fixture/healthy-bundle', requestedSpec: '1.2.3', version: '1.2.3', source: input.installedPackages[0]!.packageJsonSource, evidenceKind: 'static', integrity: 'sha512-fixture' }],
    runtime: { dsh: '0.1.0-rc.6', node: '20.0.0', platform: 'win32' }
  })
  expect(report.diagnostics.some((item) => item.id === 'missing-provenance')).toBe(false)
})

test('inventory records a fixed Git provenance for another installed bundle', async () => {
  const input = await readProfile({ profileDir: 'test/fixtures/bundle-drift' })
  expect(input.installedPackages[0]).toMatchObject({ installedVersion: '2.0.0', gitRef: '0123456789abcdef0123456789abcdef01234567' })
  expect(input.inventoryDiagnostics.some((item) => item.id === 'bundle-patch-missing')).toBe(false)
})

test('inventory preserves npm os negation semantics for platform checks', async () => {
  const input = await readProfile({ profileDir: 'test/fixtures/platform-negation' })
  const packageFact = input.installedPackages[0]
  expect(packageFact?.platform).toEqual(['!darwin'])
  const report = analyseComposition({ profileDir: input.profileDir, rows: [], adapterDiagnostics: input.inventoryDiagnostics, installedPackages: input.installedPackages, platforms: [{ packageName: packageFact!.name, source: packageFact!.packageJsonSource, evidenceKind: 'static', supported: packageFact!.platform! }], runtime: { platform: 'win32' } })
  expect(report.diagnostics.some((item) => item.id === 'platform-mismatch')).toBe(false)
})
