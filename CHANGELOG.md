# Changelog

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
