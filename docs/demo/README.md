# Failure Explainer demo assets

Two minimized public cases, captured from the built 0.4.0 CLI on 2026-10-03. These are fixture diagnoses, not transcripts of the original reporters' runtime. Every capture preserves the static / runtime-unknown boundary.

```text
DSH ERROR: duplicate loader entry id: session-cleaner
                         ↓
dsh-doctor diagnose --profile <dir> --log dsh-error.log
                         ↓
session-cleaner
├── bundle session-cleaner
│   └── node_modules/session-cleaner/cordis.patch.yml
└── profile patch
    └── cordis.patch.yml

Cause: 2 separate loader declarations use the same id.
Evidence: static. Final composition / runtime: unknown, not-run.
Next: review the bundle declaration and manual insertion together.
Doctor did not modify your profile.
```

The compact card above is an excerpt for README, Release, Discussion or a marketplace description. The full outputs below come directly from the CLI:

| Public pattern | Human output | Machine result | Markdown |
|---|---|---|---|
| [Manual insertion plus bundle, #2889](https://github.com/deepseek-ai/deepseek-harness/discussions/2889) | [Terminal](manual-bundle-duplicate.txt) | [JSON](manual-bundle-duplicate.json) | [Report](manual-bundle-duplicate.md) |
| [Missing packaged patch, #6539](https://github.com/deepseek-ai/deepseek-harness/discussions/6539) | [Terminal](missing-patch.txt) | [JSON](missing-patch.json) | [Report](missing-patch.md) |

[Full two-case terminal transcript](terminal-demo.txt) · [25-second recording script](../../scripts/failure-demo.mjs) · [Source and adaptation notes](../failure-cases.md)

After `pnpm build`, run `pnpm demo:failure` in a terminal to record the two cases in about 25 seconds. `pnpm demo:failure -- --fast` prints the same output without pauses. It performs no installation, network request, profile mutation or DSH invocation.
