# dsh-composition-doctor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only, publishable DSH plugin that scans profile composition risk, creates safe snapshots, diffs them, performs isolated preflight checks, and renders a read-only Web Settings report.

**Architecture:** A dependency-light TypeScript core parses only an allow-listed profile metadata surface into a composition model and runs pure diagnostic rules. CLI and Cordis/UI adapters project core results; the DSH preview adapter never calls private loader APIs and labels unavailable runtime resolution as unproven.

**Tech Stack:** Node.js 20+, TypeScript 5 ESM strict mode, pnpm, Vitest, `yaml`, `semver`, `@deepseek-ai/cordis`, `@deepseek-ai/schemastery`, and DSH public client slot types.

**Spec:** `docs/superpowers/specs/2026-09-15-dsh-composition-doctor-design.md`

## Global Constraints

- Use ESM and strict TypeScript; support Windows first without excluding macOS or Linux.
- Default commands perform no network I/O and never modify a selected real profile.
- Never read or serialise `.env`, secret/key/token files, environment-variable values, session bodies, or workspace file contents.
- Use only public DSH/Cordis extension points; no monkey patching or private loader imports.
- Declare DSH `>=0.1.0-rc.5 <0.2.0`, Cordis `>=4 <5`, and Node `>=20` as the initial verified range.
- Every diagnostic must carry severity, concrete evidence, explanation, and minimal remediation.
- Build scripts are disabled in preflight unless `--allow-build` is explicit.
- No GitHub remote or npm publication occurs before the user gives the template-required confirmation at the applicable release gates.

---

### Task 1: Package scaffold and command surface

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/cli/main.ts`
- Create: `src/core/types.ts`
- Create: `test/cli-help.test.ts`

**Interfaces:**
- Produces `DoctorCommand` as `'scan' | 'snapshot' | 'diff' | 'preflight'`.
- Produces `runCli(argv: readonly string[]): Promise<number>`.
- Produces shared `Severity`, `Evidence`, and `Diagnostic` types consumed by all later tasks.

- [ ] **Step 1: Write the failing CLI help test**

```ts
import { expect, test } from 'vitest'
import { runCli } from '../src/cli/main.js'

test('lists all four read-only commands in help output', async () => {
  const output: string[] = []
  const code = await runCli(['--help'], { write: (line) => output.push(line) })
  expect(code).toBe(0)
  expect(output.join('\n')).toContain('preflight')
})
```

- [ ] **Step 2: Run the test and verify expected failure**

Run: `pnpm vitest run test/cli-help.test.ts`

Expected: module resolution failure because `src/cli/main.ts` is absent.

- [ ] **Step 3: Implement the minimal ESM package and CLI dispatcher**

```ts
export async function runCli(argv: readonly string[], io = console): Promise<number> {
  if (argv.includes('--help') || argv.length === 0) {
    io.log('dsh-doctor: scan | snapshot | diff | preflight')
    return 0
  }
  return 2
}
```

Define `Diagnostic` as `{ id: string; severity: Severity; title: string; evidence: readonly Evidence[]; explanation: string; remediation: string }` and reject unknown commands without mutating the filesystem.

- [ ] **Step 4: Run the focused test and typecheck**

Run: `pnpm vitest run test/cli-help.test.ts && pnpm typecheck`

Expected: exit code 0.

- [ ] **Step 5: Commit locally after user has supplied repository-only Git identity**

Run: `git add package.json tsconfig.json vitest.config.ts .gitignore src/cli/main.ts src/core/types.ts test/cli-help.test.ts && git commit -m "chore: scaffold composition doctor"`

Expected: one local commit; do not create a remote.

### Task 2: Safe profile reader and static composition adapter

**Files:**
- Create: `src/core/profile-reader.ts`
- Create: `src/core/composition-adapter.ts`
- Create: `src/core/redaction.ts`
- Create: `test/profile-reader.test.ts`
- Create: `test/fixtures/healthy/cordis.yml`
- Create: `test/fixtures/healthy/package.json`

**Interfaces:**
- Consumes `ProfileReadOptions { profileDir: string }`.
- Produces `readProfile(options): Promise<ProfileInput>`.
- Produces `resolveComposition(input, provider?): Promise<CompositionModel>`.
- Produces `redact(value: unknown): unknown`.

- [ ] **Step 1: Write failing reader/redaction tests**

```ts
test('reads allowed composition metadata but never opens dotenv files', async () => {
  const profile = await readProfile({ profileDir: fixture('healthy') })
  expect(profile.files.map((file) => file.relativePath)).toContain('cordis.yml')
  expect(profile.files.map((file) => file.relativePath)).not.toContain('.env')
})

test('replaces recursively named secret values', () => {
  expect(redact({ apiKey: 'secret', nested: { token: 'x' } }))
    .toEqual({ apiKey: '[REDACTED]', nested: { token: '[REDACTED]' } })
})
```

- [ ] **Step 2: Verify they fail because reader and redactor do not exist**

Run: `pnpm vitest run test/profile-reader.test.ts`

Expected: import failure.

- [ ] **Step 3: Implement allow-list reading and static fallback**

Use `fs.promises.lstat` before each allowed read; allow only root `cordis.yml`, `cordis.patch.yml`, `package.json`, `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, and directly referenced bundle package manifests. Reject symlink escapes by resolving each candidate under `profileDir`. Parse YAML without executing tags. Set `evidenceKind: 'static'` and include an adapter warning when no public `ResolvedCompositionProvider` is supplied.

- [ ] **Step 4: Verify focused tests pass**

Run: `pnpm vitest run test/profile-reader.test.ts`

Expected: both safety assertions pass.

- [ ] **Step 5: Commit the reader boundary**

Run: `git add src/core/profile-reader.ts src/core/composition-adapter.ts src/core/redaction.ts test/profile-reader.test.ts test/fixtures/healthy && git commit -m "feat: read safe profile composition metadata"`

Expected: local-only commit.

### Task 3: Composition diagnostics and reports

**Files:**
- Create: `src/core/rules.ts`
- Create: `src/reports/json.ts`
- Create: `src/reports/markdown.ts`
- Create: `test/rules.test.ts`
- Create: `test/fixtures/duplicate-row-id/cordis.yml`
- Create: `test/fixtures/hook-order/cordis.yml`
- Create: `test/fixtures/ui-conflict/cordis.yml`
- Create: `test/fixtures/peer-mismatch/package.json`

**Interfaces:**
- Consumes `CompositionModel`.
- Produces `analyseComposition(model): AnalysisReport`.
- Produces `renderJson(report): string` and `renderMarkdown(report): string`.

- [ ] **Step 1: Write failing examples for observed conflicts and incomplete evidence**

```ts
test('reports duplicate row id as error with both source paths', () => {
  const report = analyseComposition(duplicateRowFixture)
  expect(report.diagnostics).toContainEqual(expect.objectContaining({
    id: 'duplicate-row-id', severity: 'error', evidence: expect.arrayContaining([
      expect.objectContaining({ subject: 'shared-row' }),
    ]),
  }))
})

test('reports multiple execute waterfalls as warning, not a confirmed failure', () => {
  const report = analyseComposition(hookOrderFixture)
  expect(report.diagnostics).toContainEqual(expect.objectContaining({
    id: 'hook-order-risk', severity: 'warning',
  }))
})
```

- [ ] **Step 2: Verify expected rule failure**

Run: `pnpm vitest run test/rules.test.ts`

Expected: missing `analyseComposition` export.

- [ ] **Step 3: Implement pure rules and deterministic report renderers**

Implement rules for duplicate ids, duplicate UI `root-slot|sidebar|layout|web-route` claims, multiple waterfall listeners, overlapping patch field paths, peer ranges against DSH/Node/Cordis facts, missing Git ref/provenance, cross-profile bundle drift, and declared platform mismatch. Use `error` only when multiple concrete conflicting declarations exist; use `warning` for ordering, missing resolver evidence, unknown provenance, and absent version facts. Markdown renders evidence paths and remediation for every rule.

- [ ] **Step 4: Verify diagnostics and formatting tests**

Run: `pnpm vitest run test/rules.test.ts && pnpm typecheck`

Expected: exit code 0, including all four fixture categories.

- [ ] **Step 5: Commit rule engine and reports**

Run: `git add src/core/rules.ts src/reports test/rules.test.ts test/fixtures && git commit -m "feat: diagnose composition conflicts"`

Expected: local-only commit.

### Task 4: Scan, snapshot, and diff commands

**Files:**
- Create: `src/core/snapshot.ts`
- Create: `src/core/diff.ts`
- Modify: `src/cli/main.ts`
- Create: `test/snapshot.test.ts`
- Create: `test/diff.test.ts`
- Create: `test/fixtures/redaction/cordis.yml`

**Interfaces:**
- Produces `createSnapshot(input): Promise<Snapshot>`.
- Produces `diffSnapshots(before, after): SnapshotDiff`.
- Adds command handlers that write only their explicit output files/directories.

- [ ] **Step 1: Write failing snapshot and diff tests**

```ts
test('snapshot excludes secret values and records lockfile SHA-256', async () => {
  const snapshot = await createSnapshot(redactionFixture)
  expect(JSON.stringify(snapshot)).not.toContain('do-not-leak')
  expect(snapshot.hashes['pnpm-lock.yaml']).toMatch(/^[a-f0-9]{64}$/)
})

test('diff classifies a plugin version decrease as a downgrade', () => {
  expect(diffSnapshots(before, after).pluginChanges)
    .toContainEqual(expect.objectContaining({ kind: 'downgraded', name: 'example' }))
})
```

- [ ] **Step 2: Verify expected failure**

Run: `pnpm vitest run test/snapshot.test.ts test/diff.test.ts`

Expected: missing module failure.

- [ ] **Step 3: Implement snapshot hashing, structural redaction, and semantic diff**

Hash only the allow-listed lock/package-manager files. Store summaries for rows, hooks, UI claims, peer/platform facts, and bundles. Diff added/removed/upgraded/downgraded plugins, rows, hooks, UI conflicts, peers, and platforms. The diff must write an upgrade-risk summary but never execute a migration.

- [ ] **Step 4: Run command-level integration tests**

Run: `pnpm vitest run test/snapshot.test.ts test/diff.test.ts && pnpm dsh-doctor scan --profile test/fixtures/healthy --format both --output .tmp-test-report`

Expected: tests pass and only `.tmp-test-report` is created; remove that test output before commit.

- [ ] **Step 5: Commit commands and remove test output**

Run: `Remove-Item -LiteralPath .tmp-test-report -Recurse -Force; git add src/core/snapshot.ts src/core/diff.ts src/cli/main.ts test/snapshot.test.ts test/diff.test.ts test/fixtures/redaction && git commit -m "feat: add scan snapshot and diff commands"`

Expected: local-only commit and no `.tmp-test-report` remains.

### Task 5: Isolated preflight

**Files:**
- Create: `src/core/preflight.ts`
- Modify: `src/cli/main.ts`
- Create: `test/preflight.test.ts`
- Create: `test/fixtures/preflight-real-profile/sentinel.txt`

**Interfaces:**
- Produces `runPreflight(options): Promise<PreflightResult>`.
- Consumes `PreflightOptions { profileDir; targetDsh; candidates; allowBuild; online }`.

- [ ] **Step 1: Write the failing non-pollution and build-gate tests**

```ts
test('preflight leaves selected profile fingerprint unchanged', async () => {
  const before = await fingerprint(realFixture)
  const result = await runPreflight({ profileDir: realFixture, targetDsh: '0.1.0-rc.6', candidates: [], allowBuild: false, online: false })
  expect(result.outcome).not.toBe('fail')
  expect(await fingerprint(realFixture)).toBe(before)
})

test('preflight emits a plan instead of building without allow-build', async () => {
  const result = await runPreflight({ profileDir: realFixture, targetDsh: '0.1.0-rc.6', candidates: ['example@2.0.0'], allowBuild: false, online: false })
  expect(result.evidence).toContainEqual(expect.objectContaining({ subject: 'build-plan' }))
})
```

- [ ] **Step 2: Verify expected failure**

Run: `pnpm vitest run test/preflight.test.ts`

Expected: missing preflight module.

- [ ] **Step 3: Implement isolated directory preparation and smoke test**

Use `fs.mkdtemp(path.join(os.tmpdir(), 'dsh-doctor-'))`. Copy only redacted/allow-listed input into that directory. Hash the real profile before and after. Parse composition and use only the public adapter for a smoke test. Return `pass`, `warning`, or `fail` with all evidence; keep the temporary directory only under `--keep-temp` for investigation.

- [ ] **Step 4: Verify isolation test passes**

Run: `pnpm vitest run test/preflight.test.ts`

Expected: sentinel fingerprint remains identical and no build is executed.

- [ ] **Step 5: Commit isolated preflight**

Run: `git add src/core/preflight.ts src/cli/main.ts test/preflight.test.ts test/fixtures/preflight-real-profile && git commit -m "feat: add isolated upgrade preflight"`

Expected: local-only commit.

### Task 6: Cordis host module and read-only Web Settings client

**Files:**
- Create: `src/plugin/index.ts`
- Create: `src/client/index.ts`
- Create: `src/client/report-view.ts`
- Create: `cordis.patch.yml`
- Create: `test/plugin-contract.test.ts`

**Interfaces:**
- Produces DSH exports `name`, `Config`, and `apply(ctx, config)`.
- Produces client export `apply(ctx)` with `inject = ['slots']`.
- Serves only `GET /dsh-composition-doctor/reports/latest`.

- [ ] **Step 1: Write failing host/client contract tests**

```ts
test('plugin exposes only a read-only latest-report endpoint', async () => {
  const routes = await registerWithFakeContext()
  expect(routes).toEqual([expect.objectContaining({ method: 'GET', path: '/dsh-composition-doctor/reports/latest' })])
})

test('client registers a settings section without repair controls', () => {
  expect(clientRegistration().id).toBe('dsh-composition-doctor')
  expect(clientRegistration().actions).toEqual(['export-json', 'export-markdown'])
})
```

- [ ] **Step 2: Verify expected failure**

Run: `pnpm vitest run test/plugin-contract.test.ts`

Expected: missing plugin/client modules.

- [ ] **Step 3: Implement public Cordis and slot registrations**

Use `ctx.effect` for all registrations. The host reads only the plugin-owned report directory and rejects all methods except GET. The client uses `settings.section` and renders diagnostic counts, a dependency/conflict graph generated from report evidence, and local download links. Do not register buttons or routes for profile/package/config mutations.

- [ ] **Step 4: Verify contract and all tests**

Run: `pnpm vitest run test/plugin-contract.test.ts && pnpm test && pnpm typecheck && pnpm build`

Expected: exit code 0 for tests, strict typecheck, and production build.

- [ ] **Step 5: Commit plugin and client**

Run: `git add src/plugin src/client cordis.patch.yml test/plugin-contract.test.ts && git commit -m "feat: add read-only DSH settings report"`

Expected: local-only commit.

### Task 7: Documentation, licence, fixture examples, and release audit

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `docs/examples/scan-report.md`
- Create: `docs/compatibility.md`
- Modify: `.gitignore`
- Create: `test/readme-examples.test.ts`

**Interfaces:**
- README documents real commands, report schema, permissions, installation/uninstallation, supported versions, limitations, and Chinese/English sections.

- [ ] **Step 1: Write a failing README example validation test**

```ts
test('README examples use the actual four command names', async () => {
  const readme = await readFile('README.md', 'utf8')
  for (const command of ['scan', 'snapshot', 'diff', 'preflight']) {
    expect(readme).toContain(`dsh-doctor ${command}`)
  }
})
```

- [ ] **Step 2: Verify expected failure**

Run: `pnpm vitest run test/readme-examples.test.ts`

Expected: `README.md` missing.

- [ ] **Step 3: Write bilingual documentation and MIT licence**

Document the no-network default, profile non-mutation, absence of security scoring, `--allow-build` gate, DSH public API versus adapter limitation, installation and uninstall commands, fixture execution, and an example warning that does not assert a confirmed failure. Add the standard MIT licence with the chosen copyright year/owner only after asking the user for the owner name.

- [ ] **Step 4: Run documentation and release audit**

Run: `pnpm test && pnpm typecheck && pnpm build; rg -n -i '(api[_-]?key|password|token|BEGIN (RSA|OPENSSH)|C:\\Users\\18439|\.tmp-test-report)' --glob '!pnpm-lock.yaml' .`

Expected: quality commands exit 0; every sensitive-looking match is inspected, redacted, removed, or documented as a schema field with no value.

- [ ] **Step 5: Commit documentation after user-supplied Git identity**

Run: `git add README.md LICENSE docs .gitignore test/readme-examples.test.ts && git commit -m "docs: prepare publishable project documentation"`

Expected: local-only commit; report audit findings before any remote action.

### Task 8: Local Git readiness and GitHub publication gates

**Files:**
- Modify: `README.md` only if release-audit findings require factual documentation changes.

**Interfaces:**
- Consumes passing `pnpm test`, `pnpm typecheck`, and `pnpm build` outputs plus a reviewed sensitive-data audit.
- Produces a local `main` repository and a proposed public repository/release plan only after user confirmation.

- [ ] **Step 1: Verify installed developer tools and account state**

Run: `git --version; gh --version; gh auth status`

Expected: record Git/GitHub CLI versions and whether interactive re-authentication is required; never display a token.

- [ ] **Step 1a: Run fixture Web acceptance before source-control publication gates**

Run: create a temporary DSH home and fixture profile, then `npx @deepseek-ai/dsh web --profile <fixture-profile> --no-open` with the locally built plugin. Open its local Web page, visit Settings, select `dsh-composition-doctor`, and verify the latest-report view plus JSON/Markdown export controls. Stop the fixture process afterwards and hash the fixture profile before/after.

Expected: the Web page loads the read-only doctor section; no repair control exists; no real DSH profile is discovered, read, or written. If `npx` needs to download DSH, request explicit network approval first.

- [ ] **Step 2: Initialise local source control and validate initial state**

Run: `git init -b main; git status --short; git diff --check; pnpm test; pnpm typecheck; pnpm build`

Expected: clean whitespace and passing quality checks before staging.

- [ ] **Step 3: Ask for local-only Git identity**

Ask the user for the exact name and verified email to set with `git config user.name` and `git config user.email` in this repository only. Do not use placeholders and do not change global configuration.

- [ ] **Step 4: Make the initial local commit**

Run: `git add -A; git commit -m "Initial commit"; git status --short`

Expected: one local commit on `main`; no remote exists.

- [ ] **Step 5: Ask explicit GitHub confirmation with exact repository name and visibility**

Present the audited file list, `gh auth status` outcome, proposed repository name, `Public` visibility, remote `origin`, and `main` push. If authentication is invalid, invoke browser-based `gh auth login` and wait for the user to finish; never request a credential in chat.

- [ ] **Step 6: Create and push only after explicit confirmation**

Run: `gh repo create <approved-name> --public --source . --remote origin --push; git remote -v; git branch -vv; git status --short`

Expected: `main` tracks `origin/main`, and no uncommitted project files remain.

- [ ] **Step 7: Prepare v0.1.0 release and obtain a second explicit confirmation**

Present test results, audit result, proposed `v0.1.0` tag, release title, and concise release notes. Create neither tag nor Release until the user explicitly confirms publication.

- [ ] **Step 8: Tag and publish only after final confirmation**

Run: `git tag -a v0.1.0 -m "v0.1.0"; git push origin v0.1.0; gh release create v0.1.0 --title "dsh-composition-doctor v0.1.0" --notes <approved-notes>`

Expected: public release exists only after the user approves this exact final action.

## Plan self-review

- Spec coverage: Tasks 1–4 cover scan/snapshot/diff/reporting; Task 5 covers isolated preflight; Task 6 covers public Cordis/Web UI integration; Task 7 covers seven fixtures, bilingual docs, licence, audit and examples; Task 8 covers each release-template gate.
- Placeholder scan: no `TODO`, `TBD`, or deferred implementation markers are present; only user-owned release decisions remain intentionally gated.
- Type consistency: `CompositionModel` flows from Task 2 to Task 3; `AnalysisReport` drives reports, snapshot, CLI, and Web; `PreflightResult` remains isolated to Task 5 and CLI dispatch.
