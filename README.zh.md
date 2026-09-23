# dsh-composition-doctor（中文）

[![npm version](https://img.shields.io/npm/v/dsh-composition-doctor)](https://www.npmjs.com/package/dsh-composition-doctor)
[![CI](https://github.com/lemonxiny55/dsh-composition-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/lemonxiny55/dsh-composition-doctor/actions/workflows/ci.yml)
[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/lemonxiny55/dsh-composition-doctor)

[English](README.md) | 中文

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的组合与升级预检工具。它读取明确指定的 profile，用可追溯证据说明可观察到的 Cordis/plugin 组合风险；不会编辑真实 profile，也不会静默扩大权限。

当前 package release：`0.3.0`。

## 模型可用能力

| 命令 | 作用 |
|---|---|
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

## 安装

```powershell
npm install -g dsh-composition-doctor
npx @deepseek-ai/dsh plugin --profile web add dsh-composition-doctor
dsh-doctor --version
```

更改 profile 后重启 Web UI：`npx @deepseek-ai/dsh web`。

## 示例

```powershell
dsh-doctor scan --profile C:\path\to\profile --format both --output .\reports\profile --publish
dsh-doctor scan --profile C:\path\to\profile --format both --output .\reports\archive --report-dir C:\safe\doctor-reports
dsh-doctor snapshot --profile C:\path\to\profile --output .\reports\before.json
dsh-doctor diff --before .\reports\before.json --after .\reports\after.json --format both
dsh-doctor preflight --profile C:\path\to\profile --target-dsh 0.1.5-rc.2
dsh-doctor why row tool-bash --profile C:\path\to\profile
dsh-doctor impact bundle @example/dsh-bundle --profile C:\path\to\profile
```

每条诊断均为 `info`、`warning` 或 `error`，并附带 evidence、explanation 和最小 remediation。`runtimeSmoke.status=not-run` 不等于 runtime PASS；`artifact-unavailable` 不等于 `incompatible`；warning 也不等于已确认失败。

## 安全与隐私

默认操作只读，或仅在操作系统临时目录中隔离运行。插件不会修改 profile、安装或删除插件、迁移配置、扩大权限，默认也不会执行网络 I/O。它不会读取 `.env`、profile 密钥、会话正文或工作区源文件内容，也不会收集或持久化任意环境变量值；启动公开 CLI 时只传递平台所需的最小进程路由变量。

## 支持范围与限制

real-release harness 已使用真实公开 CLI 验证 `@deepseek-ai/dsh@0.1.5-rc.1` 和 `@deepseek-ai/dsh@0.1.5-rc.2`。`0.1.6-alpha.1` 仍只是 expected-compatible/experimental；`0.1.0-rc.6` 仅作历史兼容背景，不是当前 verified target。artifact 不可用时会明确报告 unavailable，绝不记为 PASS。已验证开发环境为 Windows + Node.js 24；CI 覆盖 Ubuntu + Node.js 20。只有公开 metadata 能提供 hook/UI ownership 时才会确认，否则标为 unverified；临时目录不是安全 sandbox。

## 开发

```powershell
pnpm test
pnpm typecheck
pnpm build
```

仅在 checkout 开发时，构建完成后使用 `node dist/cli/main.js` 运行 CLI。

参阅 [`README.md`](README.md)、[`docs/compatibility.md`](docs/compatibility.md) 和 [`docs/examples/scan-report.md`](docs/examples/scan-report.md)。MIT 许可。
