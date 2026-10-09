# 自有仓库 PR 草稿（未创建 / 未推送）

分支：`codex/adoption-distribution-040` → `main`。

**Title**

```text
docs: make published 0.4.0 easier to discover, try and report
```

**Body**

```markdown
The repository still calls the published 0.4.0 an unpublished RC and asks users to build a tarball before trying `diagnose`. Both README languages now start with the released npm CLI, explicit Web/Desktop profile selection, a 25-second real DSH Desktop report-viewer demo and an opt-in usage-report link. The changelog and compatibility notes distinguish published status, prior host observations and unverified versions.

Adds two genuine Desktop marketplace screenshots and `screenshots.json`, CLI capture and Desktop screenshot-assembly scripts, and a public aggregate metrics recorder with no profile access or telemetry. The adoption review pack includes the existing Awesome-entry update patch, bilingual community drafts and the 2026-10-09–10-22 plan. External actions remain subject to owner review.

Validation: published tarball hash matches the prior release; independent lifecycle-disabled installation and installed Windows CLI shim succeeded; two public-pattern fixtures plus an unsupported-RPC control were captured from npm 0.4.0. All 54 relevant existing tests passed. Local file links, YAML scope, screenshot manifest and 6 real Desktop GIF frames/25s were checked; the Awesome patch applies to the audited upstream revision. Product source, package version/dependencies, fixtures and CI are unchanged.

The GIF contains real DSH Desktop 0.2.0-rc.2 interaction captures with edited reading pauses. Doctor 0.4.0 displays the existing sanitized public-pattern fixture report from the 10-04 smoke; its static/runtime-not-observed boundary remains visible. It does not show the original reporter's runtime or establish successful recovery. No npm release, public post, third-party PR or cooperation message is part of this PR. After merge, public GitHub rendering and downstream marketplace synchronization still need checking.
```

审批后按 owner 选择执行推送和创建 PR；此草稿没有获得外部动作授权。Description/topics 的拟修改值在 [审核包](README.md) 单独列出。
