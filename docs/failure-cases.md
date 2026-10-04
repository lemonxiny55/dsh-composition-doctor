# Public failure cases and demo assets

Reviewed on 2026-10-03 against Doctor main `2daf2fa20930af402dc591d5f2049878d293b42c`.

The cases below validate demand and reproducible *patterns*. Fixtures are small structural reconstructions of public reports, never downloaded personal profiles or an assertion that the original reporter's runtime was reproduced. They contain inert declarations only. Their source/adaptation records live in `test/fixtures/failures/cases.json`.

| Pattern | Public source | Regression and boundary |
|---|---|---|
| Manual insertion plus bundle insertion | [DSH #2889](https://github.com/deepseek-ai/deepseek-harness/discussions/2889) | `manual-bundle-duplicate`: two `session-cleaner` inserts. Exact row, source, layer and bundle association must match. A normal update is a negative regression. |
| Declared but unavailable bundle | [DSH #6539](https://github.com/deepseek-ai/deepseek-harness/discussions/6539) | `missing-bundle`: generic name, absent local metadata. Bounded profile resolution is not proof that an installation-level bundle cannot resolve. |
| Bundle package missing its patch | [DSH #6539, packaging comment](https://github.com/deepseek-ai/deepseek-harness/discussions/6539) | `missing-patch`: inert `dsh-cad` manifest with no YAML. Doctor correlates the named package and manifest; it never follows a path taken from the error log. |
| Target missing after bundle registration drift | [DSH #6539, target warning comment](https://github.com/deepseek-ai/deepseek-harness/discussions/6539) | `missing-target`: one `dsh-agentflow` target. No local insert is observed; unseen layers remain unknown. |
| Upgrade peer gate | [DSH #8199](https://github.com/deepseek-ai/deepseek-harness/discussions/8199) and the official `0.2.0-rc.2` compatibility formatter | `peer-upgrade`: inert `dshmarket@1.66.3` manifest with its reported settings peer range. Without an independently supplied host version the result is unknown; with `--dsh-version 0.2.0-rc.1` it explains the static mismatch. It does not guess a satisfying release or bypass a gate. |
| Whole-config replacement | [Official composition architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md), [plugin publishing guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md) and current public CLI harness | Existing `real-dsh` structural fixture checks actual bundle → profile → home → CLI precedence. Only an explicit replacement fact proves replacement; a source chain alone proves patching. Static omitted keys are not runtime data loss. |

The first two public threads show why a standalone CLI matters: a broken plugin tree can prevent the Web UI containing plugin management from starting. The upgrade report confirms demand for explaining compatibility failures. We selected six bounded explanations, with four syntax families plus structural config/peer checks; no attempt is made to infer arbitrary startup errors, runtime hook order, route ownership or hot-reload bugs.

## Two terminal demos

Build, then run from this checkout:

```sh
pnpm demo:failure
# Capture without the timing pauses:
pnpm demo:failure -- --fast
```

The recording lasts about 25 seconds: 0–2.5s show the first symptom, 2.5–12.5s show its source paths, 12.5–15s show the missing-patch symptom, 15–25s show the manifest correlation and manual next step. Each output is produced by the built CLI, never a fabricated runtime transcript. The command is platform-neutral and operates on checked-in inert fixtures. It does not install, invoke DSH runtime, change a profile or access a network.

Individual captures:

```sh
node dist/cli/main.js diagnose --profile test/fixtures/failures/manual-bundle-duplicate --log test/fixtures/failures/manual-bundle-duplicate/error.log
node dist/cli/main.js diagnose --profile test/fixtures/failures/missing-patch --log test/fixtures/failures/missing-patch/error.log
```

Reusable output artifacts are in `docs/demo/`. Use the short excerpt in a README/market description, the complete outputs when reviewing evidence, and the recording script for a release or discussion. Never remove the static/runtime boundary from a screenshot.

## Explanation contract

`FailureInput → matchFailureSignatures → compositionFacts / diagnostics → FailureResult`.

The matcher returns only a known pattern and safe candidate identity. Raw log text, arbitrary paths, instructions, environment values and claimed runtime versions never enter the model. The explainer is pure and uses the same normalized graph row keys as `why row`, `impact bundle` and the Explorer. Each explanation includes a detected symptom, origin, matched observed entity when available, observable condition, provenance paths, evidence level, unknowns, related diagnostics and a manual remediation.

`explained` means a relevant condition is observable, not that Doctor observed a crash. `unknown` means a recognized symptom lacks sufficient evidence (or required metadata was unreadable); `no-match` means the supplied log has no supported signature; `no-supported-issues` means none of these bounded conditions were found. None is a runtime health certification. Runtime stays `not-observed` and no probability or risk score is generated.

Default reads are the existing root allow-list plus explicitly declared, bounded YAML patch metadata. The reader collects insertion/update declarations; it does not implement another DSH composer. It excludes home/CLI layers, installation-level packages and external workspace links. `--composed` reuses the existing public dump adapter, whose copied-profile coverage may be incomplete. Static duplicate paths remain static even if a dump supplies a single row.

Both `diagnose` and `check` require an explicit profile directory, avoiding guesses between desktop/web or multiple DSH homes. No-match output tells the user to verify selection and use existing why/snapshot/diff/preflight capabilities. The Web enhancement reads an optional explanation from the same local report, highlights related graph nodes, and exports it through existing JSON/Markdown actions.
