# Compatibility / 兼容性

## Verified evidence in this repository

The automated contract is verified against the checked-in `test/fixtures/fake-dsh/dsh.mjs` public `--dump-config` shape, the allow-listed profile/bundle metadata shape, the GET-only Web Settings contract, and the real public CLI behavior of the releases listed below. This is release-specific verification, not a claim that every DSH release is compatible.

- Node.js: the project typechecks on the current development Node runtime; the manifest requires `>=20`.
- OS: the filesystem and CLI contract is exercised on Windows; CI additionally exercises Ubuntu.
- DSH releases verified by the real public CLI harness: `@deepseek-ai/dsh@0.1.5-rc.1` and `@deepseek-ai/dsh@0.1.5-rc.2`.
- The harness validates `--version`, `--dump-config`, layer order, row override, whole-config replacement, provenance comments, profile/home/`--patch` overlays, Windows paths, stdout/stderr parsing, and preservation of `!!js` as runtime-unknown. The checked-in goldens are redacted structural output from those release artifacts.
- `test/real-dsh-compatibility.test.ts` uses local official artifacts supplied through environment variables. Without them it reports `unavailable` by skipping the external-artifact cases; that is not a compatibility PASS.

Compatibility reports use four separate release states: `verified` means the real public harness passed; `expected-compatible` means only the public contract is expected to match; `unavailable` means the requested artifact could not be obtained from permitted sources; and `incompatible` means a real artifact was obtained but a contract or resolution check failed.

## Expected-compatible, not release-verified

`@deepseek-ai/dsh@0.1.6-alpha.1` is an experimental expected-compatible target only; it is not part of the verified release range. `0.1.0-rc.6` is historical compatibility context, not a current primary target. The adapter’s public surfaces include `--dump-config`, `dsh.profile.bundles`, `dsh.bundle.patch`, `dsh.client`, `settings.plugins.tab`, and host `webServer.register`/effect registration. A release is not verified until its public artifact runs through the harness and its output is reviewed.

The artifact resolver is offline-first: explicit binary/package/tarball, installed DSH, and Doctor-owned cache are considered before any registry access. Registry access requires explicit `--online`; downloaded artifacts remain in Doctor-owned cache/temp storage, are hash/integrity recorded, and are never installed or lifecycle-executed. An unavailable artifact remains `unavailable`/warning rather than a false verification. The implementation does not import private loaders, monkey-patch DSH, or claim OS-level sandboxing for a temporary directory.
