# Failure Explainer demo assets

## 25-second GitHub demo (2026-10-09)

![Duplicate insertion paths, actual published 0.4.0 CLI output](failure-explainer.gif)

The GIF renders actual CLI output and exact excerpts from the **published npm 0.4.0 package**, on the minimized reconstruction of public DSH case #2889. It is a text animation, not a screen recording of DSH or the original user's runtime. All full stdout remains available; the output keeps static evidence, runtime unknown and the manual next step.

0–3s: symptom; 3–6s: CLI command; 6–16s: two insertion paths; 16–20s: manual next step; 20–25s: trial command. The same GIF serves both README languages; captions and onboarding are bilingual.

[Poster / reduced-motion alternative](failure-explainer-poster.png) · [Duplicate case full image](manual-bundle-duplicate.png) · [Missing patch full image](missing-patch.png) · [Capture metadata and exact stdout](adoption-capture.json) · [Unsupported Web RPC control](unsupported-rpc.txt).

Reproduce after building, or pass the path to an independently installed 0.4.0 CLI:

```sh
node scripts/capture-adoption-demo.mjs
python scripts/render-adoption-demo.py --font "<path-to-monospace-font>"
```

The renderer uses Pillow and defaults to Windows Cascadia Mono. It wraps text for display and selects explicitly labelled excerpts; it does not write diagnosis text. Capture reads only the committed inert fixtures and writes these demo files. Neither script accesses the network, installs packages or runs DSH. The reviewed npm tarball SHA-256 is recorded in [published-status evidence](../release-evidence/0.4.0-published.md). `screenshots.json` declares the two full-output PNGs for compatible marketplace crawlers.

## Earlier two-case terminal assets

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
