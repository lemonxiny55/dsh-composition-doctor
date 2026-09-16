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

## 安装与使用

```powershell
npm install -g dsh-composition-doctor
npx @deepseek-ai/dsh plugin --profile web add dsh-composition-doctor
dsh-doctor scan --profile C:\path\to\profile --format both --output .\reports\profile
```

默认操作只读或写入操作系统临时目录，不修改真实 profile，不扩大权限，不默认联网，不读取 `.env`、密钥、token、环境变量值、会话正文或工作区文件内容。证据不足时只报告 warning。

已验证范围：DSH `>=0.1.0-rc.5 <0.2.0`、Cordis `>=4 <5`、Node.js `>=20`；Windows 优先，同时支持 macOS/Linux。
