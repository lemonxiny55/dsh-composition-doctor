# dsh-composition-doctor Design Specification

## Goal

Deliver a local-only DeepSeek Harness (DSH) composition and upgrade preflight plugin. It analyses a selected profile, emits evidence-backed diagnostics and reports, snapshots safe metadata, diffs snapshots, and rehearses upgrades in an isolated temporary directory. It never changes a real profile, installs or removes plugins, reads secrets or session contents, or contacts the network unless `--online` is supplied.

## Supported and verified DSH surface

The plugin uses only the public Cordis plugin convention: exported `name`, `Config`, and `apply(ctx, config)`. The optional client module uses the public `settings.section` slot. The scan rules use documented DSH tool-waterfall names and ordering: `tools/pre-execute`, guards, `tools/execute`, `tools/post-execute`, and `tools/result`.

The initial verified compatibility declaration is DSH `>=0.1.0-rc.5 <0.2.0`, Cordis `>=4 <5`, and Node `>=20`. The package must refuse to assert runtime composition support outside this range. It may still perform static evidence analysis and emit an explicit compatibility warning.

## Architecture

The core is independent of a running DSH process. `ProfileReader` receives an explicitly selected profile directory and reads a conservative allow-list of metadata: profile manifest, composition/patch YAML, package manifests, lockfiles, and package-manager metadata. It never traverses session directories, workspaces, `.env` files, private-key files, or environment variables.

`CompositionAdapter` is a narrow preview-version compatibility boundary. It first attempts a documented, injected `ResolvedCompositionProvider`; it does not import or monkey-patch private DSH loader objects. When no public provider is available, it constructs a labelled static candidate composition from configuration files and reports the missing runtime evidence. All diagnostics retain whether evidence is resolved or static.

`RuleEngine` is pure and operates on `CompositionModel`. It detects duplicate row ids, UI ownership conflicts, hook ordering risks, patch-field overlap, peer/runtime mismatches, install provenance, profile drift, and platform mismatches. Every diagnostic has one of `info`, `warning`, or `error`, an evidence array, an explanation, and a minimal remediation. An error is emitted only for an observed contradiction or invalid duplicate; incomplete provenance or unavailable runtime data is a warning.

Reports are projected from one `AnalysisReport` model into canonical JSON and deterministic Markdown. `SnapshotService` redacts recursively before serialising, records only selected metadata and SHA-256 hashes, and excludes secrets, environment values, sessions, and workspace content. `DiffService` compares snapshot models without consulting the live filesystem.

`PreflightService` creates a unique directory under the OS temporary directory, copies only sanitised composition inputs, and requires `--allow-build` before invoking any package-manager build lifecycle. It never writes below the selected profile. The default smoke test is parse plus adapter resolution; a launcher smoke test is available only through an explicit public-command adapter and runs without network unless `--online` is present.

The Cordis host module serves only the last generated report from its own plugin data directory through a read-only endpoint. The Web Settings page renders diagnostics, a conflict graph, and client-side report export. No control can alter profiles, packages, permissions, or network policy.

## CLI contract

`dsh-doctor scan --profile <dir> [--format json|markdown|both] [--output <dir>]`

`dsh-doctor snapshot --profile <dir> --output <file>`

`dsh-doctor diff --before <snapshot.json> --after <snapshot.json> [--format json|markdown|both]`

`dsh-doctor preflight --profile <dir> --target-dsh <version> [--candidate <package@version>]... [--allow-build] [--online]`

All path inputs are resolved before use. `--online` only enables explicitly chosen registry/package metadata adapters; without it, the services do no network I/O. Output directories are user-selected report destinations or internally-created temporary directories; no command mutates a real profile.

## Data model

`CompositionModel` contains `profile`, runtime facts, bundles, rows, UI claims, hook registrations, patch writes, and provenance. Each record includes package name, version when known, source file, and evidence kind.

`Diagnostic` contains `id`, `severity`, `title`, `evidence`, `explanation`, and `remediation`. Evidence has an absolute-or-profile-relative path, a subject such as row id or slot, package/version, and source classification. Reports include a stable schema version and generation timestamp.

`Snapshot` contains a schema version, redacted profile manifest summary, package/bundle inventory, resolved-composition summary, and hashes for permitted lockfile/package-manager metadata. Raw configuration is not embedded; only a redacted, structurally bounded summary is included.

## Safety invariants

- No `.env`, key, token, environment-variable value, session body, or workspace file body is read, emitted, copied, or hashed.
- The scanner accepts only an explicit profile path; it does not automatically discover or inspect a user DSH home.
- Network I/O is disabled by default and bounded to `--online` adapters.
- No install, uninstall, repair, migration, privilege adjustment, private API import, or monkey patch exists in the package.
- Preflight proves non-pollution by recording the selected profile fingerprint before and after execution; any difference is a failure.

## Tests and fixtures

Unit tests exercise each diagnostic rule, redaction, snapshot determinism, and diff classification. Fixtures cover: a healthy one-plugin profile; duplicate row id; multiple hook ordering; UI slot conflict; peer mismatch; snapshot redaction; and preflight isolation. Integration tests run the CLI against fixtures and assert that preflight leaves a real-profile sentinel unchanged.

Final acceptance additionally launches a local fixture profile with `npx @deepseek-ai/dsh web` using a temporary DSH home. The test installs only this locally built plugin into that fixture, visits the Web Settings page, and verifies that the doctor section can display/export a generated report without any repair action. It must not use or alter a real DSH profile.

## Known limitations

The stable public DSH API does not yet provide a verified cross-version runtime composition introspection contract. The initial adapter therefore treats actual-resolved composition as opt-in through a public provider. Without it, findings based on YAML/manifest evidence are explicitly marked static and cannot establish runtime success or failure. Web Settings registration is guarded by a peer range because DSH remains a developer preview.
