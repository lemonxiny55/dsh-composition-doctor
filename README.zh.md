# dsh-composition-doctor（中文）

[![npm version](https://img.shields.io/npm/v/dsh-composition-doctor)](https://www.npmjs.com/package/dsh-composition-doctor)
[![CI](https://github.com/lemonxiny55/dsh-composition-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/lemonxiny55/dsh-composition-doctor/actions/workflows/ci.yml)

[English](README.md) | 中文

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的组合与升级预检工具。它读取明确指定的 profile，用可追溯证据说明可观察到的 Cordis/plugin 组合风险；不会编辑真实 profile，也不会静默扩大权限。

## 模型可用能力

| 命令 | 作用 |
|---|---|
| `dsh-doctor scan` | 检测重复 Cordis row、hook 顺序风险、UI slot/route 所有权冲突、bundle 覆盖、peer/platform 不匹配和 profile 漂移。 |
| `dsh-doctor snapshot` | 生成脱敏、可比较的 profile 快照及 lockfile 哈希。 |
| `dsh-doctor diff` | 汇总新增、删除或升级的插件，以及 rows、hooks、UI 声明、peer 和平台变化。 |
| `dsh-doctor preflight` | 在独立临时 profile 中演练目标 DSH 升级。 |

Web Settings 页面仅供显示与导出：它读取最新本地报告、展示冲突图，并导出 JSON/Markdown；不提供修复、安装或卸载操作。

## 报告与证据边界

`scan --output <目录>` 只写入显式指定的目录。要让只读 Settings 页面看到同一份报告，必须显式选择 `--publish`，它会复制到默认插件目录 `.dsh-composition-doctor/reports`；也可以使用 `--report-dir <目录>` 发布到配置的插件报告目录。请使用 `--format both`，使 Web route 能读取 `report.json`，同时保留 Markdown 导出。报告目录不能是 profile、`.env` 所在位置，或任何含密钥、token 或其他敏感信息的目录。

报告中的 `evidenceMode` 标明证据来源：`static` 仅表示允许列表中的根级 YAML/manifest 元数据；`resolved` 需要注入公开 runtime provider；`mixed` 预留给同时提供两类来源的适配器。静态发现和有限的 metadata coverage 不能证明最终 runtime composition。本版本没有内置稳定的公开 DSH runtime provider。

`preflight --candidate package@version` 会将验证通过的精确引用写入隔离临时 `package.json`，并让其声明元数据参与静态分析。它不会下载、安装、加载候选包，也不会运行候选包的 lifecycle script；未安装候选包内部的 peer/platform 信息和 runtime 兼容性仍属未验证。`--allow-build` 目前仅记录未来 runner 的显式门槛，仍不会执行任何第三方脚本。

## 安装

```powershell
npm install -g dsh-composition-doctor
npx @deepseek-ai/dsh plugin --profile web add dsh-composition-doctor
```

更改 profile 后重启 Web UI：`npx @deepseek-ai/dsh web`。也可以在 checkout 中使用 `node dist/cli/main.js` 运行 CLI。

## 示例

```powershell
dsh-doctor scan --profile C:\path\to\profile --format both --output .\reports\profile --publish
dsh-doctor scan --profile C:\path\to\profile --format both --output .\reports\archive --report-dir C:\safe\doctor-reports
dsh-doctor snapshot --profile C:\path\to\profile --output .\reports\before.json
dsh-doctor diff --before .\reports\before.json --after .\reports\after.json --format both
dsh-doctor preflight --profile C:\path\to\profile --target-dsh 0.1.0-rc.6
```

每条诊断均为 `info`、`warning` 或 `error`，并附带 evidence、explanation 和最小 remediation。缺少 runtime 证据时只会作为 warning 报告，绝不会当作已确认失败。

## 安全与隐私

默认操作只读，或仅在操作系统临时目录中隔离运行。插件不会修改 profile、安装或删除插件、迁移配置、扩大权限，默认也不会执行网络 I/O。它不会读取 `.env`、密钥、token、环境变量值、会话正文或工作区源文件内容。

## 支持范围与限制

已验证预览范围：DSH `>=0.1.0-rc.5 <0.2.0`、Cordis `>=4 <5`、Node.js `>=20`；Windows 是一等平台，macOS/Linux 也受支持。DSH 尚未公开稳定的 resolved-composition introspection API，因此未接入公开 provider 时，静态发现会被明确标注。

## 开发

```powershell
pnpm test
pnpm typecheck
pnpm build
```

参阅 [`README.md`](README.md)、[`docs/compatibility.md`](docs/compatibility.md) 和 [`docs/examples/scan-report.md`](docs/examples/scan-report.md)。MIT 许可。
