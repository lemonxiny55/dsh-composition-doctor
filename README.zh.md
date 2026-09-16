# dsh-composition-doctor（中文）

[English](README.md) | 中文

面向 DeepSeek Harness（DSH）的本地只读组合与升级预检插件。它读取明确指定的 profile，分析 Cordis/plugin 组合风险，生成脱敏快照，比较升级差异，并在独立临时目录中演练升级。

## 功能

| 命令 | 作用 |
|---|---|
| `dsh-doctor scan` | 检测重复 row、hook 顺序风险、UI slot/route 冲突、bundle 覆盖、peer/platform 不匹配和 profile 漂移。 |
| `dsh-doctor snapshot` | 生成脱敏、可比较的 profile 快照和 lockfile 哈希。 |
| `dsh-doctor diff` | 比较插件、rows、hooks、UI、peer 和平台变化。 |
| `dsh-doctor preflight` | 在独立临时目录预演目标 DSH 升级。 |

Web Settings 只读显示最近报告、冲突图并导出 JSON/Markdown，不提供修复、安装或卸载操作。

## 报告与证据边界

`scan --output <目录>` 只写入该显式目录。要让只读 Settings 页面看到同一份报告，必须显式加 `--publish`，它会发布到插件默认目录 `.dsh-composition-doctor/reports`；或者用 `--report-dir <目录>` 发布到配置的目录。请使用 `--format both`，这样 Web route 可读取 `report.json`，同时保留 Markdown 导出。报告目录不得是 profile、`.env` 所在目录，或任何包含密钥、token 等敏感信息的目录。

报告的 `evidenceMode` 表示证据来源：`static` 仅为允许列表中的根级 YAML/manifest 元数据；`resolved` 必须来自注入的公开 runtime provider；`mixed` 留给同时具有两类来源的适配器。静态发现和有限的 metadata coverage 不是最终 runtime composition 的证明；当前版本未内置稳定公开的 DSH runtime provider。

`preflight --candidate package@version` 会将合法的精确引用放入隔离临时 `package.json`，使其声明元数据参与静态分析。它不会下载、安装、加载候选包，也不会执行第三方生命周期脚本；未安装候选包内部的 peer/platform 元数据与 runtime 兼容性仍未验证。`--allow-build` 目前仅记录未来 runner 的显式门槛，仍不会执行任何第三方脚本。

## 安装与使用

```powershell
npm install -g dsh-composition-doctor
npx @deepseek-ai/dsh plugin --profile web add dsh-composition-doctor
dsh-doctor scan --profile C:\path\to\profile --format both --output .\reports\profile --publish
```

默认操作只读或写入操作系统临时目录，不修改真实 profile，不扩大权限，不默认联网，不读取 `.env`、密钥、token、环境变量值、会话正文或工作区文件内容。证据不足时只报告 warning。

已验证范围：DSH `>=0.1.0-rc.5 <0.2.0`、Cordis `>=4 <5`、Node.js `>=20`；Windows 优先，同时支持 macOS/Linux。
