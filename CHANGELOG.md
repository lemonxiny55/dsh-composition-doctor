# Changelog

## 0.4.0 — Failure Explainer (unreleased RC)

- Add `diagnose` and the small `check` alias: human-first explanations connect supported symptoms to entities, independent source paths, evidence boundaries and manual next steps.
- Add a pure failure matcher/explainer shared with additive report/Web data. Default diagnosis inspects selected static metadata without running DSH, importing plugins or accessing the network. Public composed evidence remains opt-in.
- Support duplicate loader declarations, unavailable bundles, missing/invalid patches, unmatched targets, DSH-family peer/version mismatches and config replacement/override explanations. Normal updates and patch provenance chains are never treated as duplicate insertions.
- Accept bounded, untrusted file/stdin error logs; never store raw lines or treat log-reported versions as trusted runtime facts. Refuse secret/workspace/session/chat files and profile-mutating report destinations.
- Add minimized public failure regressions, synchronized bilingual onboarding, two demos, release/discussion drafts and a 25-second terminal recording script.
- Recheck the current npm DSH release (`0.2.0-rc.2`) with the public composition harness. Extend CI to Windows/Ubuntu and Node 20/22/24, including packed fresh-install smoke. Runtime execution remains not-run.
- Correct snapshot producer version metadata and preserve graph identities for same-layer duplicate declarations.
- Fix the installed Unix CLI launcher and an identical-artifact concurrent cache publication race exposed by Windows RC verification.

No npm publish, tag, GitHub Release or Discussion has been created.

## 0.3.0

- Add read-only `why row` and bounded `impact bundle` explanations using shared, versioned composition facts.
- Extend reports and Web Settings with a redacted bundle/source/layer/row provenance graph; older reports remain readable without the graph.
- Keep field ownership, removed config keys, route/slot ownership, runtime hook ownership, arbitrary dependencies, and possible dependents unknown unless directly observed.

## 0.2.2

- Fixed the packaged `dsh-doctor` CLI entrypoint when pnpm's Windows shim supplies a non-canonical path.
- Added a built-entrypoint regression test covering `--version` and `--help`.

## 0.2.1

- Fixed clean-checkout CI coverage by tracking the report schema and committed fixture packages that were previously hidden by broad ignore rules.
- Fixed cross-platform Snapshot v2 path normalization for Windows-style paths on Linux CI.
- Added the dsh-plugin.org listing badge to the bilingual README files.

## 0.2.0

- Release the verified 0.2.0 package without changing the established diagnostic architecture or evidence boundaries.

## 0.1.3

- Hardened the release package contract with the `dsh-doctor` binary entry.
- Added packed-package verification coverage and documented scan exit-code thresholds.
- Hardened npm artifact cache writes with integrity metadata and atomic temporary-file publication.
- Reject unsafe tar paths and link entries before reading package metadata.
- Kept DSH compatibility verified only for `0.1.5-rc.1` and `0.1.5-rc.2`; `0.1.6-alpha.1` remains expected-compatible only.
- Runtime smoke remains `not-run` unless a trusted OS-level isolation backend is available.
- Two Windows symlink regressions may remain `skipped` when the test process cannot create file symlinks; this is not a compatibility PASS.
- `0.1.6-alpha.1` is experimental/expected-compatible and is not part of the verified release range.
- A temporary directory is not a security sandbox; no runtime safety claim is made from temporary-directory execution.
