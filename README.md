# dsh-composition-doctor

[![npm version](https://img.shields.io/npm/v/dsh-composition-doctor)](https://www.npmjs.com/package/dsh-composition-doctor)
[![CI](https://github.com/lemonxiny55/dsh-composition-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/lemonxiny55/dsh-composition-doctor/actions)

English | [中文](README.zh.md)

Composition and upgrade preflight doctor for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`). It reads an explicitly selected profile and explains observable Cordis/plugin composition risks with concrete evidence. It never edits a real profile or silently changes permissions.

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

Reports declare `evidenceMode`: `static` means allow-listed root YAML/manifest metadata only; `resolved` requires an injected public runtime provider; `mixed` is reserved for an adapter that supplies both. Static findings and the bounded metadata coverage are not proof of the final runtime composition. This release has no stable public DSH runtime provider bundled.

`preflight --candidate package@version` inserts a validated exact reference into an isolated temporary `package.json` and includes that declared metadata in static analysis. It never downloads, installs, loads, or runs candidate lifecycle scripts; peer/platform facts inside an uninstalled candidate and runtime compatibility remain unverified. `--allow-build` is only a recorded future runner gate and still executes no third-party script.

## Install

```powershell
npm install -g dsh-composition-doctor
npx @deepseek-ai/dsh plugin --profile web add dsh-composition-doctor
```

Restart the Web UI (`npx @deepseek-ai/dsh web`) after changing a profile. The CLI can also run from a checkout with `node dist/cli/main.js`.

## Example

```powershell
dsh-doctor scan --profile C:\path\to\profile --format both --output .\reports\profile --publish
dsh-doctor scan --profile C:\path\to\profile --format both --output .\reports\archive --report-dir C:\safe\doctor-reports
dsh-doctor snapshot --profile C:\path\to\profile --output .\reports\before.json
dsh-doctor diff --before .\reports\before.json --after .\reports\after.json --format both
dsh-doctor preflight --profile C:\path\to\profile --target-dsh 0.1.0-rc.6
```

Each finding is `info`, `warning`, or `error` and includes evidence, explanation, and the smallest remediation. Missing runtime evidence is reported as a warning, never as a confirmed failure.

## Safety and privacy

Default operations are read-only or isolated under the OS temporary directory. The plugin does not modify profiles, install/remove plugins, migrate configuration, escalate permissions, or perform network I/O by default. It never reads `.env`, keys, tokens, environment values, session bodies, or workspace file contents.

## Support and limitations

Verified preview range: DSH `>=0.1.0-rc.5 <0.2.0`, Cordis `>=4 <5`, Node.js `>=20`; Windows is first-class and macOS/Linux are supported. DSH has not yet exposed a stable resolved-composition introspection API, so static findings are explicitly labelled when no public provider is available.

## Development

```powershell
pnpm test
pnpm typecheck
pnpm build
```

See [`README.zh.md`](README.zh.md), [`docs/compatibility.md`](docs/compatibility.md), and [`docs/examples/scan-report.md`](docs/examples/scan-report.md). MIT licensed.
