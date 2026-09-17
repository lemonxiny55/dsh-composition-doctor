# DSH Composition Doctor MVP Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the package installable and verifiable while keeping reports, preflight evidence, snapshots, and the read-only web UI consistent.

**Architecture:** Add a single report-location contract shared by CLI publication and the plugin route. Extend the data model with explicit evidence mode and metadata coverage, while keeping the static adapter and an injected runtime provider separate. Candidate preflight data is represented only in an isolated package manifest and is analyzed statically without package installation.

**Tech Stack:** TypeScript ESM, Vitest, ScheMastery, semver, YAML.

**Spec:** User request in this task.

## Global Constraints

- Do not write to a real DSH profile or invoke package-manager/lifecycle scripts for candidates.
- Web routes remain read-only and never expose local paths, parser stacks, or raw exceptions.
- Use disposable profiles and fixtures only for DSH checks.
- Do not claim runtime resolution without an injected public provider.

---

### Task 1: Restore package and report contract

**Files:** `package.json`, `src/cli/main.ts`, `src/plugin/index.ts`, new `src/reports/location.ts`, CLI/plugin tests.

- [ ] Add failing tests for explicit report publication, missing reports, malformed JSON sanitization, optional schema configuration, and package contents.
- [ ] Run the targeted tests and record the baseline failure or dependency blocker.
- [ ] Implement the shared default report directory plus explicit `--publish`/`--report-dir`; keep `--output` independent.
- [ ] Make `reportDir` genuinely optional with the shared default, and make the route read that directory only.
- [ ] Re-run targeted tests.

### Task 2: Model evidence and metadata coverage

**Files:** `src/core/types.ts`, `src/core/composition-adapter.ts`, `src/core/profile-reader.ts`, report renderers, client view, tests.

- [ ] Add failing tests for static/no-provider, resolved-provider, and coverage/unscanned-surface behavior.
- [ ] Add explicit static/resolved/unverified evidence fields and keep provider injection as the only runtime source.
- [ ] Return bounded metadata coverage without recursively reading profiles or sensitive surfaces.
- [ ] Render evidence mode and diagnostic detail safely in Markdown and the Web UI.
- [ ] Re-run targeted tests.

### Task 3: Make preflight candidates truthful

**Files:** `src/core/preflight.ts`, `src/core/composition-adapter.ts`, preflight tests, README files.

- [ ] Add failing tests proving valid candidates enter only temporary metadata and impact static analysis, invalid candidates do not, and build scripts never run.
- [ ] Inject validated package/version candidates into the isolated manifest and map them to static bundle/peer facts.
- [ ] Record accepted, metadata-inspected, package-not-installed, and runtime-unverified evidence.
- [ ] Re-run targeted tests and fixture fingerprints.

### Task 4: Snapshot, diff, docs, and packaging

**Files:** `src/cli/main.ts`, `src/core/diff.ts`, snapshot/diff tests, READMEs, package tests.

- [ ] Add failing tests for snapshot parent creation/overwrite/error messages and composite plugin identity with prerelease semver changes.
- [ ] Create snapshot parent directories, retain explicit overwrite semantics, and normalize path errors.
- [ ] Use profile/package/source plugin keys and `semver.compare` for full prerelease comparison.
- [ ] Document report publishing, sensitive-directory restrictions, static/runtime boundaries, and candidate limitations in both READMEs.
- [ ] Build a tarball and inspect its contents for required artifacts.

### Task 5: Full verification with a disposable profile

**Files:** disposable temporary directory only; no real profile mutations.

- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm build` from available/offline dependencies and report any registry blocker exactly.
- [ ] Create a disposable metadata-only DSH profile, run scan with explicit publication, invoke the read-only route, and verify JSON/Markdown export content.
- [ ] Attempt real DSH plugin install/start only if the DSH executable and its required packages are present locally; otherwise report it as unverified rather than simulating it.
