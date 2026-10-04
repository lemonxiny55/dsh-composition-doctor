import { lstat, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { parse } from 'yaml'
import { valid, validRange } from 'semver'
import { resolveComposition } from './composition-adapter.js'
import { safeFailureEntity } from './failure-explainer.js'
import type { CompositionModel, CompositionRow, Diagnostic, ProfileInput } from './types.js'

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function note(id: string, source: string, packageName: string | undefined, detail: string): Diagnostic {
  return { id, severity: 'warning', title: detail,
    evidence: [{ source, ...(packageName === undefined ? {} : { packageName, subject: packageName }), detail, evidenceKind: 'static' }],
    explanation: detail, remediation: 'Review the declared bundle patch and selected profile. Doctor did not change either.' }
}

/** Parse declarations, never simulate a runtime tree or evaluate YAML tags. */
function declarations(text: string, source: string, layer: string, layerOrder: number, bundle?: string): CompositionRow[] {
  const parsed: unknown = parse(text, { maxAliasCount: 50, logLevel: 'silent', customTags: [
    { tag: 'tag:yaml.org,2002:js', resolve: () => '<runtime value: not-run>' },
    { tag: 'tag:yaml.org,2002:js/function', resolve: () => '<runtime value: not-run>' }
  ] })
  const entries = Array.isArray(parsed) ? parsed : layer === 'cordis.yml' && record(parsed) ? parsed.plugins : undefined
  if (!Array.isArray(entries)) throw new Error('Patch must be a top-level array')
  const rows: CompositionRow[] = []
  const add = (entry: unknown, operation: CompositionRow['operation']): void => {
    if (!record(entry)) return
    rows.push({ ...(typeof entry.id === 'string' && safeFailureEntity(entry.id) !== undefined ? { id: entry.id } : {}),
      ...(typeof entry.name === 'string' && safeFailureEntity(entry.name) !== undefined ? { name: entry.name } : {}),
      source, layer, layerOrder, provenance: [bundle ?? source], operation, evidenceKind: 'static',
      ...(operation === 'update' && !('config' in entry) ? { replacement: false } : {}),
      ...('config' in entry ? { configKeys: record(entry.config) ? Object.keys(entry.config).filter((key) => /^[a-z_][\w.-]{0,127}$/i.test(key)).sort() : [],
        ...(operation === 'update' ? { replacement: true, replacementBasis: 'derived' as const } : {}) } : {}) })
  }
  for (const entry of entries) {
    if (!record(entry)) continue
    if ('insert' in entry) {
      if (!Array.isArray(entry.insert)) throw new Error('Insert must be an array')
      for (const inserted of entry.insert) add(inserted, 'insert')
    } else add(entry, layer === 'cordis.yml' ? 'declare' : 'update')
  }
  return rows
}

/** Default diagnose reads only selected profile metadata and declared YAML patches.
 * It does not look up executables, launch DSH, import packages or run lifecycles. */
export async function readFailureComposition(input: ProfileInput, composed = false): Promise<CompositionModel> {
  const rows: CompositionRow[] = []
  const diagnostics: Diagnostic[] = [...input.inventoryDiagnostics]
  const root = await realpath(input.profileDir)
  for (const [index, pkg] of input.installedPackages.entries()) {
    if (pkg.bundlePatch === undefined) continue
    try {
      const path = await realpath(pkg.bundlePatch)
      const rel = relative(root, path)
      // A manifest is untrusted: a patch declaration is not permission to read secrets.
      if (isAbsolute(rel) || rel.startsWith('..') || !/\.(?:yml|yaml)$/i.test(path) ||
          /(?:^|[\\/])(?:\.env[^\\/]*|[^\\/]*(?:credential|token|secret|password)[^\\/]*|sessions?|chats?|workspace)(?:[\\/]|$)/i.test(rel)) {
        diagnostics.push(note('bundle-patch-unsafe', pkg.packageJsonSource, pkg.name, 'Declared patch is outside the permitted YAML metadata surface.'))
        continue
      }
      const meta = await lstat(path)
      if (!meta.isFile() || meta.size > 1024 * 1024) throw new Error('Patch unavailable')
      rows.push(...declarations(await readFile(path, 'utf8'), path, `dsh.profile.bundles[${index}]: ${pkg.name}`, index, pkg.name))
    } catch {
      // No parser snippets, values, or raw filesystem error text enter the report.
      diagnostics.push(note('bundle-patch-invalid', pkg.packageJsonSource, pkg.name, 'Declared bundle patch is missing, unreadable, oversized or invalid YAML.'))
    }
  }
  for (const file of input.files) {
    if (file.relativePath !== 'cordis.yml' && file.relativePath !== 'cordis.patch.yml') continue
    try { rows.push(...declarations(file.text, file.relativePath, file.relativePath, input.installedPackages.length + (file.relativePath === 'cordis.yml' ? 0 : 1))) }
    catch { diagnostics.push(note('profile-patch-invalid', file.relativePath, undefined, 'Selected profile YAML is invalid or not a supported top-level array.')) }
  }
  const safeRange = (value: string | undefined): string | undefined => value !== undefined && value.length <= 256 && validRange(value) !== null ? value : undefined
  const packages = input.installedPackages.filter((pkg) => safeFailureEntity(pkg.name) !== undefined).map((pkg) => ({
    ...pkg, installedVersion: pkg.installedVersion !== undefined && valid(pkg.installedVersion) !== null ? pkg.installedVersion : undefined
  }))
  const peers = packages.flatMap((pkg) => [
    { packageName: pkg.name, source: pkg.packageJsonSource, evidenceKind: 'static' as const, cordis: safeRange(pkg.peerCordis), node: safeRange(pkg.engineNode) },
    ...Object.entries(pkg.dshPeers ?? (pkg.peerDsh === undefined ? {} : { '@deepseek-ai/dsh': pkg.peerDsh })).map(([dshPackage, range]) => ({
      packageName: pkg.name, source: pkg.packageJsonSource, evidenceKind: 'static' as const, dshPackage,
      dsh: ['workspace:^', 'workspace:~', 'workspace:*'].includes(range) ? range : safeRange(range)
    }))
  ])
  const base: CompositionModel = { profileDir: root, rows, installedPackages: packages,
    adapterDiagnostics: diagnostics, evidenceMode: 'static', runtimeObservation: { observed: false },
    metadataCoverage: input.metadataCoverage, peerRequirements: peers,
    runtime: { node: process.versions.node, platform: process.platform } }
  if (!composed) return base
  const observed = await resolveComposition(input)
  // Preserve declarations separately via their evidence kind; a dump that dedupes
  // rows cannot upgrade a static duplicate-path finding into a composed collision.
  return { ...base, rows: [...rows, ...observed.rows.filter((row) => row.evidenceKind === 'composed')],
    adapterDiagnostics: [...diagnostics, ...observed.adapterDiagnostics],
    evidenceMode: observed.evidenceMode === 'composed' ? 'mixed' : 'static' }
}
