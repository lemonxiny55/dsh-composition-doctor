import { access, readFile } from 'node:fs/promises'

import { inspectInstalledPackage } from './package-provenance.js'
import type { Diagnostic, InstalledPackageFact } from './types.js'

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function diagnostic(id: string, title: string, source: string, detail: string): Diagnostic {
  return {
    id,
    severity: 'warning',
    title,
    evidence: [{ source, detail, evidenceKind: 'static' }],
    explanation: detail,
    remediation: 'Install the declared bundle in the selected profile or provide the missing public manifest/patch metadata.'
  }
}

function bundleNames(manifest: Record<string, unknown>): Array<{ name: string; requestedSpec?: string }> {
  const dsh = record(manifest.dsh)
  const profile = record(dsh?.profile)
  const bundles = profile?.bundles
  if (!Array.isArray(bundles)) return []
  return bundles.flatMap((entry): Array<{ name: string; requestedSpec?: string }> => {
    if (typeof entry === 'string') return [{ name: entry }]
    const object = record(entry)
    const name = typeof object?.name === 'string' ? object.name : typeof object?.package === 'string' ? object.package : undefined
    if (name === undefined) return []
    return [{ name, ...(typeof object?.version === 'string' ? { requestedSpec: object.version } : {}) }]
  })
}

export async function inspectBundleInventory(profileDir: string, packageJsonText: string): Promise<{ packages: readonly InstalledPackageFact[]; diagnostics: readonly Diagnostic[] }> {
  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(packageJsonText) as Record<string, unknown>
  } catch {
    return { packages: [], diagnostics: [diagnostic('bundle-inventory-manifest-invalid', 'Profile package manifest is invalid', 'package.json', 'The profile package.json could not be parsed, so dsh.profile.bundles cannot be inspected.')] }
  }
  const packages: InstalledPackageFact[] = []
  const diagnostics: Diagnostic[] = []
  for (const declared of bundleNames(manifest)) {
    try {
      const fact = await inspectInstalledPackage(profileDir, declared.name, declared.requestedSpec)
      packages.push(fact)
      if (fact.bundlePatch !== undefined) {
        try { await access(fact.bundlePatch) } catch {
          diagnostics.push(diagnostic('bundle-patch-missing', 'Bundle patch metadata is missing', fact.packageJsonSource, `${declared.name} declares dsh.bundle.patch at ${fact.bundlePatch}, but that file is not readable.`))
        }
      } else {
        diagnostics.push(diagnostic('bundle-patch-unavailable', 'Bundle patch metadata is unavailable', fact.packageJsonSource, `${declared.name} has no readable dsh.bundle.patch declaration.`))
      }
      if (fact.integrity === undefined && fact.gitRef === undefined) {
        diagnostics.push(diagnostic('bundle-provenance-unavailable', 'Bundle immutable provenance is unavailable', fact.packageJsonSource, `${declared.name} has neither registry integrity nor a fixed Git reference in its readable manifest.`))
      }
    } catch (error: unknown) {
      diagnostics.push(diagnostic('bundle-not-installed', 'Declared bundle is not installed or readable', 'package.json', `${declared.name}${declared.requestedSpec === undefined ? '' : `@${declared.requestedSpec}`} could not be resolved from the selected profile: ${error instanceof Error ? error.message : String(error)}`))
    }
  }
  return { packages, diagnostics }
}
