# 社区内容 — 所有草稿待审核，未发布

先合并自有仓库资产再发布，以下 main 链接目前只是预定的公开位置。中英文可在同一条回复中合并，也可按线程语言择一；不要将两个版本发布成两条重复公告。

## 官方 Discussion #8891 的技术补充

目标：[既有 0.4.0 公告](https://github.com/deepseek-ai/deepseek-harness/discussions/8891)。不再重复版本功能清单，以“怎么试、怎样解释结果”为主。

### 中文可发布正文

补一个可以复现的 25 秒示例：当同一个 `session-cleaner` 同时来自 bundle 的 patch 和 profile 的手写 `insert` 时，Failure Explainer 会把两条引入路径放在一起，方便决定下一步检查哪份声明。

![0.4.0 CLI 故障来源演示](https://raw.githubusercontent.com/lemonxiny55/dsh-composition-doctor/main/docs/demo/failure-explainer.gif)

这是已发布 npm 0.4.0 CLI 在公开案例 [#2889](https://github.com/deepseek-ai/deepseek-harness/discussions/2889) 的最小重建 fixture 上的实际输出渲染，**不是原用户 runtime 录像，也没有证明当前 DSH 仍存在该旧 bug**。普通 patch update 不会被算作第二次引入。[完整输出、另一个缺失 patch 示例和复现说明](https://github.com/lemonxiny55/dsh-composition-doctor/tree/main/docs/demo)。

不必先让 Web UI 启动，也不必先向故障 profile 安装宿主插件：

```sh
npm install -g dsh-composition-doctor@0.4.0 --ignore-scripts
dsh-doctor check --profile "<实际profile目录>"
dsh-doctor diagnose --profile "<实际profile目录>" --log ./minimal-error.log
```

Node.js ≥20。标准 Web profile 通常为 `$HOME/.dsh/profiles/web`，Desktop 通常为 `$HOME/.dsh/profiles/desktop`；以宿主实际选择的目录为准。默认诊断只读、离线，不启动 DSH 或第三方 runtime，不自动修复。

一个关键边界：`unknown`、`no-match` 或退出码 0 不代表 profile 健康，也不能排除配置或 runtime 问题。0.4.0 目前只解释已支持且有元数据证据的模式。

如果你已经遇到类似的重复加载、缺 patch 或 peer 不匹配，欢迎分享：Doctor/DSH/OS 版本、最小脱敏错误 signature、`explained/unknown/no-match` 结果，以及下一步人工检查是否有帮助。[简短反馈模板](https://github.com/lemonxiny55/dsh-composition-doctor/issues/new?template=usage-report.md)。不要上传完整 profile、密钥、session 或 workspace 内容；没有自动采集。若它确实帮到了你，推荐给遇到同类问题的人或留一个 Star 都很有帮助。

### English ready-to-post body

Here is a reproducible 25-second example: when `session-cleaner` is inserted by both a bundle patch and a manual profile patch, the Failure Explainer puts the two source paths together so you can inspect the right declarations next.

![Actual 0.4.0 CLI source-path demo](https://raw.githubusercontent.com/lemonxiny55/dsh-composition-doctor/main/docs/demo/failure-explainer.gif)

This renders actual output from the published npm 0.4.0 CLI on a minimized reconstruction of [public case #2889](https://github.com/deepseek-ai/deepseek-harness/discussions/2889). It is not the reporter's runtime recording or evidence that the historical host bug persists today. Ordinary patch updates are not counted as duplicate insertions. [Full stdout, a missing-patch example, and reproduction instructions](https://github.com/lemonxiny55/dsh-composition-doctor/tree/main/docs/demo).

You can try the standalone CLI while the Web UI is down:

```sh
npm install -g dsh-composition-doctor@0.4.0 --ignore-scripts
dsh-doctor check --profile "<actual-profile-directory>"
dsh-doctor diagnose --profile "<actual-profile-directory>" --log ./minimal-error.log
```

Node.js ≥20. Select the directory your host actually uses; `--profile` is not a nickname. The standard Web and Desktop paths are commonly `$HOME/.dsh/profiles/web` and `$HOME/.dsh/profiles/desktop`. Default diagnosis is read-only and offline, without starting DSH or third-party runtimes or applying repairs.

`unknown`, `no-match`, or exit 0 does not mean the profile is healthy. It cannot rule out configuration or runtime problems; 0.4.0 explains only supported patterns backed by observable metadata.

If you encounter duplicate loading, a missing patch, or a peer mismatch, useful feedback is your Doctor/DSH/OS versions, one sanitized error signature, the result, and whether the next manual check helped. [Short opt-in usage report](https://github.com/lemonxiny55/dsh-composition-doctor/issues/new?template=usage-report.md). No full profiles, secrets, session contents, or workspace files; no telemetry. If it helped, recommending it to someone with the same problem or leaving a Star helps others find it.

## #9044 — 先澄清实际使用结果（择一发布）

目标：[外部试用者的已定位问题](https://github.com/deepseek-ai/deepseek-harness/discussions/9044)。这里不再贴安装广告，不声称工具定位了 `Config=null`。

### 中文

我是 Composition Doctor 的维护者。感谢你记录 0.4.0 的实际输出，需要澄清一个边界：`No supported failure signature matched. Cause: unknown.` 只表示这段症状没有匹配到当前支持的模式，不能用来排除配置语法、插件组合或 runtime 故障。

你后续独立定位的 `Config = null` → Settings schema → welcome RPC 失败，属于 0.4.0 没有建模的 runtime 问题；这个根因是你的验证结果，不是 Doctor 的诊断成果。我会把这次使用记录为 “no-match，范围外，用户独立定位”，并让 README 更明确解释 unknown。无需再上传 profile 或完整日志。

### English

I maintain Composition Doctor. One clarification about the 0.4.0 output you recorded: `No supported failure signature matched. Cause: unknown.` means the symptom did not match a supported pattern. It does not rule out configuration, composition, or runtime faults.

Your later independent finding—`Config = null` causing the Settings schema query and welcome RPC to fail—is outside 0.4.0's runtime model. That root cause belongs to your investigation, not to Doctor. I will record this as a no-match/out-of-scope use and make the unknown boundary clearer in the README. No additional profile or full log upload is needed.

## #6539 或 #2889 — 可复現来源诊断补充

两者只选择仍需要信息的一处回复；旧线程无新需求时跳过。正文与 #8891 的公告不同，直接给出可检查的来源和边界。

### 中文（#6539）

这类问题可以先把“包是否可解析”和“manifest 声明的 patch 是否实际打包”分开检查。我们将此线程里缺失 YAML patch 的公开模式最小化成了 inert fixture，`dsh-composition-doctor@0.4.0` 的实际 CLI 输出会关联 `dsh-cad` manifest，并建议检查 `dsh.bundle.patch` 和 publisher tarball，而不会沿错误日志里的路径执行文件。

[完整输出与复现 fixture](https://github.com/lemonxiny55/dsh-composition-doctor/blob/main/docs/demo/missing-patch.md)。这不是原用户环境的重放。默认只看到选定 profile 的静态元数据；安装层 bundle、外部链接或未观察的 runtime 仍可未知。它能缩小检查位置，不能证明所有未匹配 target 都是实际启动错误，也不自动修改配置。

### English (#2889)

The useful distinction here is an independent insertion versus an ordinary patch update. We minimized this thread's public pattern into an inert fixture: the published `dsh-composition-doctor@0.4.0` CLI shows `session-cleaner` from the bundle patch and the profile patch as two insertion paths. A normal update is covered by a negative regression and is not treated as a second insertion.

[Full stdout and reproduction](https://github.com/lemonxiny55/dsh-composition-doctor/blob/main/docs/demo/manual-bundle-duplicate.md). This is a reconstructed metadata pattern, not a replay of your runtime or a claim that the historical host bug still exists. The result remains static/runtime-unknown; review both declarations and their intended config before making any manual change.

## 合作邀请 — zoahdev（未发送）

渠道选择：先在对方公开的相关维护讨论中联系；不猜邮箱，不批量私信。不提出本轮新增代码集成。

### 中文

你好，我维护 `lemonxiny55/dsh-composition-doctor`。0.4.0 面向已经安装的 profile：在 Web UI 无法启动时，用独立 CLI 解释可观察的重复引入、缺 patch 和 peer mismatch 来源；默认只读离线，runtime 未观察时保留 unknown。

你的 plugin doctor / 教程面向发布前检查，很适合与 profile 来源诊断互补。我整理了两个有公开来源的最小 inert fixture 和实际输出：[案例](https://github.com/lemonxiny55/dsh-composition-doctor/blob/main/docs/failure-cases.md)。想请你看看“包发布前检查→profile 出问题后检查来源”是否值得在各自文档中互链；如果已有更合适的材料，也愿意参考。无需背书、Star 或投入新集成，没时间或不适合也完全没问题。

### English

Hi, I maintain `lemonxiny55/dsh-composition-doctor`. Version 0.4.0 focuses on installed profiles: a standalone CLI explains observable duplicate insertions, missing patches, and peer mismatches when the Web UI cannot open. Default diagnosis is read-only/offline, with unobserved runtime left unknown.

Your plugin doctor and publishing tutorials could complement profile source-path diagnosis. I prepared two public-source inert fixtures and actual CLI outputs: [cases](https://github.com/lemonxiny55/dsh-composition-doctor/blob/main/docs/failure-cases.md). Would a documentation cross-link between pre-publication package checks and post-install profile investigation be useful? Suggestions for better existing material are welcome. No endorsement, Star, or new integration work requested; no pressure if it is not a fit.
