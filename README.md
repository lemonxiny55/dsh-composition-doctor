# dsh-composition-doctor

[![npm version](https://img.shields.io/npm/v/dsh-composition-doctor)](https://www.npmjs.com/package/dsh-composition-doctor)
[![CI](https://github.com/lemonxiny55/dsh-composition-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/lemonxiny55/dsh-composition-doctor/actions/workflows/ci.yml)
[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/lemonxiny55/dsh-composition-doctor)

English | [中文](README.zh.md)

Composition and upgrade preflight doctor for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`). It reads an explicitly selected profile and explains observable Cordis/plugin composition risks with concrete evidence. It never edits a real profile or silently changes permissions.

Current package release: `0.2.2`.

## What the model gets

| Command | Purpose |
|---|---|
| `dsh-doctor scan` | Detect duplicate Cordis rows, hook-order risks, UI slot/route ownership conflicts, bundle overrides, peer/platform mismatches, and profile drift. |
| `dsh-doctor snapshot` | Create a redacted, comparable profile snapshot with lockfile hashes. |
| `dsh-doctor diff` | Summarize added/removed/upgraded plugins, rows, hooks, UI claims, peers, and platforms. |
| `dsh-doctor preflight` | Rehearse a target DSH upgrade in an isolated temporary profile. |

The Web Settings page is display/export only: it reads the latest local report, shows a conflict graph, and exports JSON/Markdown. It has no repair, install, or uninstall action.

## Reports and evidence boundaries

`scan --output <dir>` writes only to the requested directory. To make the same report visible to the read-only Settings page, opt in explicitly: `--publish` copies it to the default plugin directory `.dsh-composition-doctor/reports`, while `--report-dir <dir>` publishes to a configured plugin directory. Use `--format both` so the Web route has `report.json` and Markdown remains exportable. Do not use a profile directory, `.env` location, or any directory containing keys, tokens, or other secrets as a report directory.

Reports declare `evidenceMode`: `static` means allow-listed manifest/patch/package metadata only; `composed` means a public `dsh --profile <name> --dump-config` command returned a composition result; `runtime-observed` is reserved for a successful isolated runtime observation backend; and `mixed` is reserved for an adapter that supplies both. `dump-config` never proves runtime execution, including when a `!!js` or other runtime-dependent value is present. Static findings and bounded metadata coverage are not proof of the final runtime composition. If no compatible public DSH CLI is available, scan falls back to static and records a warning. Reports written before evidence schema 2 may still be read as legacy `resolved`, but new reports never emit that label.

`preflight --candidate package@version` records a validated exact reference in an isolated temporary `package.json`. Target artifact discovery is local-first (`--dsh-bin`, package directory, tarball, installed `dsh`, `--package-manager-cache`, then Doctor-owned cache); registry access is allowed only with explicit `--online`. Online resolution downloads exact registry tarballs into Doctor-owned cache, records source/version/integrity/hash, and never installs or runs lifecycle scripts. `--allow-build` does not grant permission to execute third-party runtime code.

`scan --fail-on never|info|warning|error` controls the scan exit code. The default is `never`: warnings and errors remain in the report without changing the exit code. `info` fails on any diagnostic, `warning` fails on warnings or errors, and `error` fails only on errors. Malformed arguments return exit code 2; operational failures return 1.

## Install

```powershell
npm install -g dsh-composition-doctor
npx @deepseek-ai/dsh plugin --profile web add dsh-composition-doctor
dsh-doctor --version
```

Restart the Web UI (`npx @deepseek-ai/dsh web`) after changing a profile.

## Example

```powershell
dsh-doctor scan --profile C:\path\to\profile --format both --output .\reports\profile --publish
dsh-doctor scan --profile C:\path\to\profile --format both --output .\reports\archive --report-dir C:\safe\doctor-reports
dsh-doctor snapshot --profile C:\path\to\profile --output .\reports\before.json
dsh-doctor diff --before .\reports\before.json --after .\reports\after.json --format both
dsh-doctor preflight --profile C:\path\to\profile --target-dsh 0.1.5-rc.2
```

Each finding is `info`, `warning`, or `error` and includes evidence, explanation, and the smallest remediation. `runtimeSmoke.status=not-run` is not a runtime PASS; `artifact-unavailable` is not `incompatible`; and a warning is not a confirmed failure.

## Safety and privacy

Default operations are read-only or isolated under the OS temporary directory. The plugin does not modify profiles, install/remove plugins, migrate configuration, escalate permissions, or perform network I/O by default. It never reads `.env`, profile secrets, session bodies, or workspace file contents, and does not collect or persist arbitrary environment-variable values. Public CLI execution receives only the minimal process-routing variables required by the host platform.

## Support and limitations

The real public CLI harness verifies `@deepseek-ai/dsh@0.1.5-rc.1` and `@deepseek-ai/dsh@0.1.5-rc.2`. `0.1.6-alpha.1` remains expected-compatible/experimental only; `0.1.0-rc.6` is historical context, not a current verified target. Missing artifacts are reported as unavailable, never as PASS. Verified development runtime: Node.js 24 on Windows; CI covers Node.js 20 on Ubuntu. Runtime hook/UI ownership is reported as unverified unless public metadata supplies it, and a temp profile is not a security sandbox.

## Development

```powershell
pnpm test
pnpm typecheck
pnpm build
```

For checkout-only development, run the CLI with `node dist/cli/main.js` after building.

See [`README.zh.md`](README.zh.md), [`docs/compatibility.md`](docs/compatibility.md), and [`docs/examples/scan-report.md`](docs/examples/scan-report.md). MIT licensed.
