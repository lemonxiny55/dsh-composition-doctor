# dsh-composition-doctor（中文）

[![npm version](https://img.shields.io/npm/v/dsh-composition-doctor)](https://www.npmjs.com/package/dsh-composition-doctor)
[![CI](https://github.com/lemonxiny55/dsh-composition-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/lemonxiny55/dsh-composition-doctor/actions/workflows/ci.yml)
[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/lemonxiny55/dsh-composition-doctor)

[English](README.md) | 中文

> **安装或升级插件后，DSH 启动失败了？**
>
> Composition Doctor 0.4.0 把支持的故障关联到下一步应检查的 bundle、patch 或 profile layer。即使 Web UI 打不开，也能从终端检查。

**只读 · 默认离线诊断 · 不自动修复 · Node.js ≥20**

## 快速开始

[0.4.0 已发布到 npm](https://www.npmjs.com/package/dsh-composition-doctor/v/0.4.0)。安装独立 CLI，再选择你的实际 profile 目录：

```sh
npm install -g dsh-composition-doctor@0.4.0 --ignore-scripts
dsh-doctor --version
dsh-doctor check --profile "$HOME/.dsh/profiles/web"
```

版本命令应输出 `0.4.0`。上面的路径适用于 Bash 和 PowerShell 中的标准 Web profile。Desktop 请选它实际使用的目录（通常为 `$HOME/.dsh/profiles/desktop`）；自定义 DSH home 可能不同。`--profile` 接受**目录**，不是 `web` 或 `desktop` 昵称。CLI 诊断不需要 DSH 正在运行，也不需要先安装宿主插件。安装会下载 npm 包，之后默认诊断可以离线运行。

有最小错误日志时：

```sh
dsh-doctor diagnose --profile "$HOME/.dsh/profiles/web" --log ./minimal-error.log
```

没有日志时，`check` 检查同一套受支持的元数据条件。`unknown`、`no-match` 或退出码 0 **不代表 profile 健康**；看不到的层和未观察的 runtime 保留 unknown。

不方便全局安装时，可用 `npx --yes --package=dsh-composition-doctor@0.4.0 dsh-doctor check --profile "<实际profile目录>"`（首次使用会下载包）。全局安装后找不到命令，可重开终端或检查 npm global bin 路径。profile 读取错误应先核对目录和访问权限，它不是插件不兼容的诊断。

### 25 秒看懂故障来源

![真实 DSH Desktop 中的 Composition Doctor 0.4.0：展开 fixture 故障解释并查看 bundle/profile 来源节点](docs/demo/failure-explainer.gif)

GIF 截取了 **DSH Desktop 0.2.0-rc.2 中运行 Doctor 0.4.0 的真实界面**：打开已有的脱敏 fixture 报告、展开解释，再选择两条来源 row。报告重建自[公开案例 #2889](https://github.com/deepseek-ai/deepseek-harness/discussions/2889)，停留时长经过剪辑；未展示原报告者的 runtime。普通 patch update 不会被当作重复插入。[静态图片与完整输出](docs/demo/README.md) · [包缺少 patch 的输出](docs/demo/missing-patch.txt) · [来源与能力边界](docs/failure-cases.md)。

**找到了来源，还是得到 unknown？** 欢迎[提交简短使用反馈](https://github.com/lemonxiny55/dsh-composition-doctor/issues/new?template=usage-report.md)，说明下一步人工检查的结果。反馈完全自愿，没有遥测。如果帮到了你，Star 或推荐给遇到同类问题的人能帮助更多用户发现它。

### 可选 Web Explorer

排查启动失败时，独立 CLI 已经够用。在正常运行的 Web profile 中安装报告查看器：

```sh
dsh plugin --profile web add dsh-composition-doctor@0.4.0
```

重启宿主后打开 Composition Doctor 设置标签（Desktop：设置 → 内置插件 → DSH Composition Doctor）。Desktop 用户走正常插件管理界面，输入 npm spec `dsh-composition-doctor@0.4.0`。查看器读取显式 `--report-dir` 导出的报告，详见[报告发布](#报告与证据边界)。安装宿主插件和导出报告是两个独立的自愿步骤。

支持管道和结构化输出：

```sh
dsh web 2>&1 | dsh-doctor diagnose --profile ./web
dsh-doctor diagnose --profile ./web --log - --format json
dsh-doctor diagnose --profile ./web --format markdown
```

默认 `diagnose`/`check` 只读取静态元数据，不启动 DSH、不导入插件代码、不执行 lifecycle script、不访问网络。`check` 是复用相同 reader 的极简别名，同样需要明确指定 profile。JSON 返回版本化的 explanation；`--output <目录>` 或 `--report-dir <目录>` 写入含 `failureExplanation` 和 `compositionFacts` 的兼容分析报告及 Markdown。输出目录必须位于 profile 外；默认不写报告。

继续追踪具体来源：

```powershell
dsh-doctor why row tool-bash --profile C:\path\to\profile
dsh-doctor impact bundle @example/dsh-bundle --profile C:\path\to\profile
```

`why` 解释一个可观察 row 的来源链；`impact bundle` 列出有直接 source 关联证据的 rows 和 diagnostics。

```mermaid
flowchart LR
  B["Bundle<br/>直接关联"] --> S["Source"]
  S -->|"introduced / patched-by"| R["Row"]
  L["Layer"] -->|"contains"| R
  R -->|"diagnosed-by"| D["Diagnostic"]
```

只有报告中存在支持 facts 时才展示这些关系；没有 ownership 证据的部分仍标为 unknown。

## 真实故障案例

1. **bundle 与手写 insert 重复加载。** [DSH Discussion #2889](https://github.com/deepseek-ai/deepseek-harness/discussions/2889) 报告了插件管理把依赖加入 bundle 列表，而旧手写 row 仍然存在的情况。最小化回归把 `session-cleaner` 关联到两条 insert 路径。应一起检查 bundle 声明和手写 patch；普通 patch update 不会被算成第二次引入。
2. **已安装包缺少它声明的 patch。** [DSH Discussion #6539](https://github.com/deepseek-ai/deepseek-harness/discussions/6539) 的评论报告了 npm `dsh-cad` 缺少 YAML overlay。最小化 fixture 的输出摘录：

```text
Bundle patch is unavailable: dsh-cad
reported-by-log; evidence: static

Path 1: bundle dsh-cad → <PROFILE>/node_modules/dsh-cad/package.json

Next: Review the bundle manifest → dsh.bundle.patch and packaged YAML file.
Doctor did not modify your profile.
```

这些是公开故障模式的脱敏结构重建，不是用户 profile 原件，也不声称重放了现场 runtime。同一日志缺少匹配元数据时，测试要求返回 `unknown`。

## 支持的解释

| 模式 | 可观察依据 | 边界 |
|---|---|---|
| duplicate loader id | 独立 insert/base-row 声明，或 composed tree 中重复 row | 普通 update、patched source chain 不算第二次插入，不推断 runtime 已拒绝。 |
| bundle 不可解析 | profile 声明及有边界的本地解析 finding | 安装级内置 bundle、外部 link 可能在其他位置可解析。 |
| bundle patch 缺失/无效 | manifest 与缺失、无效或不允许读取的 YAML | 不跟随日志建议的文件或命令。 |
| patch target 缺失 | patch target 没有本地 insert，或公开 dump finding | home/CLI/内置 layer 可能仍提供该 row。 |
| peer/version 不兼容 | 已安装 DSH-family peer range 与独立指定的 `--dsh-version <精确版本>`；Node engine 使用 Doctor 当前进程版本 | 日志中的版本不是 runtime fact，不猜测可用插件版本。 |
| config replacement/override | config patch 声明、composed provenance/replacement fact | 未观察到的有效键丢失、字段 owner 保持 unknown。 |

升级后的 ownership 变化继续通过 `snapshot`/`diff`、`preflight` 检查；任意 route/slot/hook 根因不进入本版 pattern。`diagnose --composed` 显式启用既有的隔离公开 dump adapter，不安装包、不启动插件 runtime、不把静态声明升级为 composed evidence。复制 profile/provider 的覆盖可能不完整，runtime 仍是 `not-observed`。

日志限制 1 MiB；显式文件只接受 `.log`、`.txt`、`.out`，拒绝 secret、workspace、session、chat 路径。最多保留 32 个日志 signature 和 50 条元数据解释；JSON 标明截断，人类输出默认显示前三条。退出 0 表示生成了报告，包括 `unknown`/`no-match`，不表示 DSH 健康；执行失败返回 1，参数错误返回 2。

[命令能力](#模型可解释什么) · [证据边界](#报告与证据边界) · [安全与隐私](#安全与隐私) · [兼容范围](#支持范围与限制) · [开发](#开发)

## 模型可解释什么

| 命令 | 作用 |
|---|---|
| `dsh-doctor diagnose` | 从明确选择的元数据解释支持的故障，可用不可信日志聚焦。默认人类可读，支持 JSON/Markdown。 |
| `dsh-doctor check` | 使用同一有边界的 reader 检查明确指定的 profile，并提示如何进一步 diagnose。 |
| `dsh-doctor scan` | 检测重复 Cordis row、hook 顺序风险、UI slot/route 所有权冲突、bundle 覆盖、peer/platform 不匹配和 profile 漂移。 |
| `dsh-doctor snapshot` | 生成脱敏、可比较的 profile 快照及 lockfile 哈希。 |
| `dsh-doctor diff` | 汇总新增、删除或升级的插件，以及 rows、hooks、UI 声明、peer 和平台变化。 |
| `dsh-doctor preflight` | 在独立临时 profile 中演练目标 DSH 升级。 |
| `dsh-doctor why row <id>` | 基于明确指定的 profile 中可观察的来源和 layer 信息解释一个 row。 |
| `dsh-doctor impact bundle <name>` | 列出有直接来源关联证据的 bundle rows 和 diagnostics。 |

`why` 和 `impact` 都需要 `--profile <目录>`。报告新增可选、版本化且脱敏的 `compositionFacts`，由这两个命令和 Web Composition Explorer 共用。Web Settings 仍然只读：它读取最新本地报告，展示诊断图和 composition 图，并导出 JSON/Markdown；不提供修复、安装或卸载操作。

Composition facts 描述公开 `--dump-config` 返回的结构；无法取得时仅描述静态声明。`introduced` 和 `patched-by` 表示 DSH 输出中记录的来源链，不证明逐字段 owner。若未观察到前层 config key，移除的键和字段 owner 必须是 unknown。route/slot ownership、runtime hook ownership、任意依赖和可能的 dependents 会标记为未观察/未建模。

## 报告与证据边界

`scan --output <目录>` 只写入显式指定的目录。要让只读 Settings 页面看到同一份报告，必须显式选择 `--publish`，它会复制到默认插件目录 `.dsh-composition-doctor/reports`；也可以使用 `--report-dir <目录>` 发布到配置的插件报告目录。请使用 `--format both`，使 Web route 能读取 `report.json`，同时保留 Markdown 导出。报告目录不能是 profile、`.env` 所在位置，或任何含密钥、token 或其他敏感信息的目录。

报告中的 `evidenceMode` 标明证据来源：`static` 仅表示 allow-list 中的 manifest、patch、package metadata 等静态证据；`composed` 表示公开 `dsh --profile <name> --dump-config` 返回了 composition 结果；`runtime-observed` 只允许真正启动隔离 runtime 并观察到注册/行为的后端使用；`mixed` 预留给同时提供多类来源的适配器。`dump-config` 即使成功，也不代表 runtime 已验证；存在 `!!js` 等运行时依赖时尤其如此。找不到兼容的公开 DSH CLI 时会回退到 static，并明确报告 warning。旧的 evidence schema 2 之前报告仍可按 legacy `resolved` 读取，但新报告不会再输出该标签。

`preflight --candidate package@version` 只会把通过校验的精确引用记录到隔离临时 `package.json`。目标 artifact 默认按本地优先顺序查找：`--dsh-bin`、本地 package directory、本地 tarball、已安装 `dsh`、`--package-manager-cache`、Doctor 自己的 cache；只有显式 `--online` 才允许访问 registry。在线解析会把精确 tarball 写入 Doctor 自己的 cache，记录来源、版本、integrity 和 hash，并且不会安装或执行 lifecycle script。`--allow-build` 不等于允许执行第三方 runtime code。

`scan --fail-on never|info|warning|error` 控制 scan 的退出码。默认是 `never`：warning 和 error 会写入报告，但不改变退出码；`info` 遇到任意诊断时退出 1，`warning` 遇到 warning 或 error 时退出 1，`error` 只在 error 时退出 1。参数错误退出 2，执行失败退出 1。

更改 profile 后重启 Web UI（`npx @deepseek-ai/dsh web`），再重新扫描。

每条诊断均为 `info`、`warning` 或 `error`，并附带 evidence、explanation 和最小 remediation。`runtimeSmoke.status=not-run` 不等于 runtime PASS；`artifact-unavailable` 不等于 `incompatible`；warning 也不等于已确认失败。

## 更多命令

```powershell
dsh-doctor scan --profile C:\path\to\profile --format both --output .\reports\profile --publish
dsh-doctor scan --profile C:\path\to\profile --format both --output .\reports\archive --report-dir C:\safe\doctor-reports
dsh-doctor snapshot --profile C:\path\to\profile --output .\reports\before.json
dsh-doctor diff --before .\reports\before.json --after .\reports\after.json --format both
dsh-doctor preflight --profile C:\path\to\profile --target-dsh 0.1.5-rc.2
```

## 安全与隐私

默认操作只读，或仅在操作系统临时目录中隔离运行。插件不会修改 profile、安装或删除插件、迁移配置、扩大权限，默认也不会执行网络 I/O。它不会读取 `.env`、profile 密钥、会话正文或工作区源文件内容，也不会收集或持久化任意环境变量值；启动公开 CLI 时只传递平台所需的最小进程路由变量。

## 支持范围与限制

Doctor 要求 Node.js `>=20`。发布检查覆盖 Windows/Ubuntu × Node 20/22/24，包含 packed fresh-install smoke；Node 24 作业通过真实 DSH `0.2.0-rc.2` 的公开 `--version`/`--dump-config` harness。此前 Desktop 验收仅覆盖 **DSH Desktop 0.2.0-rc.2 / Windows 11** 的安装、报告 UI/导出和禁用/再启用后的冷启动。它们不代表任意第三方 runtime 或所有宿主均已验证。2026-10-09 核对 DSH npm `latest` 仍为 `0.2.0-rc.2`；`0.2.1-alpha.2` 本轮未验证。`0.1.5-rc.1`/`rc.2` golden 仅作历史证据。[兼容性细节](docs/compatibility.md) · [已发布版本证据](docs/release-evidence/0.4.0-published.md) · [最终 main 发布 CI](https://github.com/lemonxiny55/dsh-composition-doctor/actions/runs/37253989774)。

## 开发

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm pack
pnpm smoke:pack ./dsh-composition-doctor-0.4.0.tgz
```

运行开发命令前，使用 `pnpm install --frozen-lockfile` 安装 checkout 依赖。

仅在 checkout 开发时，构建完成后使用 `node dist/cli/main.js` 运行 CLI。

参阅 [`README.md`](README.md)、[`docs/compatibility.md`](docs/compatibility.md) 和 [`docs/examples/scan-report.md`](docs/examples/scan-report.md)。MIT 许可。
