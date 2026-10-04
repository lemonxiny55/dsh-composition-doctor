# Compatibility / 兼容性

## Verified evidence in this repository

The automated contract covers the checked-in public dump shape, selected metadata, and GET-only Web Settings. Release checks below refer specifically to the public composition CLI; they do not verify third-party plugin runtime behavior or actual Web UI registration on every release.

- Node.js: the current RC is checked locally on Node.js 24.19.0/Windows and 20.19.5/24.19.0 on Ubuntu 24.04 under WSL. Doctor's manifest requires `>=20`. [Hosted CI on 2026-10-04](https://github.com/lemonxiny55/dsh-composition-doctor/actions/runs/37187050083) passed all six Windows/Ubuntu jobs on Node 20.20.2, 22.23.3 and 24.21.0, including packed fresh-install smoke.
- Current release: npm `latest` was checked on 2026-10-03 as `@deepseek-ai/dsh@0.2.0-rc.2`. Its official CLI was installed in separate test directories with lifecycle scripts disabled; the public `--version`/`--dump-config` harness passed locally on Windows/Ubuntu with Node 24.19.0, and on both hosted Node 24.21.0 jobs.
- Historical goldens: `@deepseek-ai/dsh@0.1.5-rc.1` and `@deepseek-ai/dsh@0.1.5-rc.2`. Their original observations remain historical evidence; missing local artifacts cause explicit skips, not renewed verification.
- The harness validates `--version`, `--dump-config`, layer order, row override, whole-config replacement, provenance comments, profile/home/`--patch` overlays, Windows paths, stdout/stderr parsing, and preservation of `!!js` as runtime-unknown. The checked-in goldens are redacted structural output from those release artifacts.
- `test/real-dsh-compatibility.test.ts` accepts `DSH_DOCTOR_REAL_DSH_CURRENT_BIN` for the current release, and the older RC1/RC2 variables for historical releases. Without the named artifacts it reports `unavailable` by skipping those cases. CI installs the exact current artifact for the Node 24 matrix only; runtime loading remains not-run.

Compatibility reports use four separate release states: `verified` means the real public harness passed; `expected-compatible` means only the public contract is expected to match; `unavailable` means the requested artifact could not be obtained from permitted sources; and `incompatible` means a real artifact was obtained but a contract or resolution check failed.

## Explainable Composition facts

Report schema version 1 remains readable. New reports may include `compositionFacts` schema version 1, an optional deterministic and redacted graph shared by `why row`, `impact bundle`, and Web Settings. Its `introduced`/`patched-by` relations are derived from the public dump provenance chain; they do not assert field-level ownership. A missing chain, layer, prior config, package mapping, or runtime observation remains unknown. Legacy reports without `compositionFacts` continue to render their diagnostic graph and show composition provenance as unavailable.

## Expected-compatible, not release-verified

`@deepseek-ai/dsh@0.2.1-alpha.1` (npm alpha on 2026-10-03) is expected-compatible/experimental only. Historical `0.1.6-alpha.1` and `0.1.0-rc.6` are not current verified targets. The adapter’s public surfaces include `--dump-config`, `dsh.profile.bundles`, `dsh.bundle.patch`, `dsh.client`, `settings.plugins.tab`, and host `webServer.register`/effect registration. A release is not verified until its exact artifact runs through the appropriate harness and its output is reviewed.

## Failure Explainer scope

Default diagnosis uses static insertion/update syntax and the existing versioned composition graph; it never invokes DSH. The manifest inventory is bounded to the selected profile, including internal pnpm links; external links and installation-level built-ins may be unavailable to this reader even when DSH can resolve them. Thus a local resolution warning is not a proven startup failure. `--composed` reuses the existing copied-profile adapter and records its actual coverage/fallback. A single composed row does not upgrade two static declarations to a composed duplicate.

DSH-family peers (`@deepseek-ai/dsh` and `@deepseek-ai/dsh-*`) are checked against an independently selected exact DSH version, matching the current public compatibility gate's version convention and workspace-range treatment. Node engines use the actual Doctor process; Cordis remains unknown without a trusted fact. Version exemptions and other local host policy are not read, so a static peer mismatch does not assert that a particular host refused to load the plugin.

Logs are untrusted signature inputs, not provider output. Runtime versions, paths or commands appearing in a log never become trusted model facts. File logs and static patches have explicit format/size/path bounds, and reports cannot be exported into the selected profile. No OS sandbox or runtime verification is claimed. See [public cases and contract](failure-cases.md) and [0.4.0 evidence](release-evidence/0.4.0.md).

The artifact resolver is offline-first: explicit binary/package/tarball, installed DSH, and Doctor-owned cache are considered before any registry access. Registry access requires explicit `--online`; downloaded artifacts remain in Doctor-owned cache/temp storage, are hash/integrity recorded, and are never installed or lifecycle-executed. An unavailable artifact remains `unavailable`/warning rather than a false verification. The implementation does not import private loaders, monkey-patch DSH, or claim OS-level sandboxing for a temporary directory.
