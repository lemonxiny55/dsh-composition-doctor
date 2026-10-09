# Failure Explainer demo assets

## 25-second real DSH Desktop demo (2026-10-09)

![Doctor 0.4.0 in real DSH Desktop: failure explanation and both source rows](failure-explainer.gif)

This GIF contains **real UI interaction captures from DSH Desktop 0.2.0-rc.2 on Windows, with Doctor 0.4.0 enabled**. It opens the existing saved report, expands its failure explanation, scrolls to the manual next step, then selects the bundle and profile insertion rows in Composition Explorer. The six actual UI states have edited reading pauses; this is an edited screenshot sequence, not continuous video. Application pixels are preserved in the source PNGs; captions are outside the UI, and GIF encoding quantizes colors.

这是实际 DSH Desktop 的操作画面，六个界面状态按阅读需要剪为 25 秒。只裁掉设置对话框外的私人侧栏，字幕在原界面外。报告是 10-04 宿主验收时已有的脱敏 fixture，并非 10-09 新发现的真实用户故障；不声称原用户恢复成功或当前 DSH 仍存在历史 bug。

The report reconstructs the insertion pattern from [public case #2889](https://github.com/deepseek-ai/deepseek-harness/discussions/2889). It was generated on **2026-10-04**, with profile paths already sanitized as `<PROFILE>`, and reused for this capture. Its hash matches the currently configured report file and the earlier Desktop smoke backup. The report retains **static evidence, runtime not-observed, unknown final composition, and manual remediation**. No profile settings or plugin toggles changed during capture. Ordinary patch updates are not duplicate insertions. This demonstrates the real report viewer, not the original reporter's runtime or an automatic repair.

| Time | Real Desktop interaction |
|---|---|
| 0–3s | Saved report overview |
| 3–7s | Expanded Failure Explanation |
| 7–13s | Unknowns and manual next step |
| 13–17s | Composition Explorer source nodes |
| 17–21s | Bundle row: packaged `cordis.patch.yml` source |
| 21–25s | Profile row: local `cordis.patch.yml` source |

[Poster / reduced-motion alternative](failure-explainer-poster.png) · [Desktop explanation screenshot](desktop-explanation.png) · [Desktop source screenshot](desktop-source.png) · [Native capture metadata and per-frame hashes](desktop-capture.json) · [Displayed report JSON](desktop-report.json).

The explanation's long preformatted path line overflows in the existing UI. The two subsequent row-detail captures show each source field in full; the GIF does not redraw that line or invent a different layout. The complete report is linked above.

`screenshots.json` declares two genuine Desktop screenshots for compatible marketplace crawlers. To reassemble this GIF from the committed native captures (Pillow and a Chinese/Latin font required):

```sh
python scripts/assemble-desktop-demo.py --font "<path-to-font>"
```

For a new native capture: use a working Desktop with Doctor 0.4.0, open Settings → Built-in plugins → DSH Composition Doctor, load an explicitly published safe fixture report, expand the explanation and select its source rows. Capture only the Settings dialog; record report/version/date and image hashes. Never upload personal account, session, workspace or unsanitized profile information. CLI generation and viewer configuration are separate opt-in actions; see the README's report-publishing instructions.

The independent **published npm 0.4.0 CLI verification** remains separate: [Capture metadata and exact stdout](adoption-capture.json) · [Unsupported Web RPC control](unsupported-rpc.txt) · [Published tarball evidence](../release-evidence/0.4.0-published.md). To repeat those inert CLI checks, pass an independently installed 0.4.0 CLI path:

```sh
node scripts/capture-adoption-demo.mjs "<path-to-dist/cli/main.js>"
```

That capture does not run DSH or third-party runtimes. A healthy fixture plus the unsupported Web RPC signature returns no-match/unknown; it does not rule out configuration or runtime faults.

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
