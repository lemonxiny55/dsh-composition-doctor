# dsh-composition-doctor

DeepSeek Harness (DSH) 的本地组合与升级预检插件。它只读取用户明确指定的 profile 元数据，输出有证据的 Cordis/插件组合诊断，并在独立临时目录中演练升级；不会修改真实 profile、安装或卸载插件，也不会扩大权限。

## 中文

### 功能

- `scan`：分析显式 profile 的 composition，输出 JSON/Markdown。
- `snapshot`：生成脱敏、可比较的 profile 快照和 lockfile 哈希。
- `diff`：比较两个快照，识别插件升降级、rows、hooks、UI、peer/platform 变化。
- `preflight`：在 OS 临时目录中进行离线解析和最小 smoke test；没有 `--allow-build` 时只输出构建计划。
- DSH Settings 页面：只读显示最近报告、冲突关系和本地导出按钮。

### 安装与卸载

```powershell
pnpm install
pnpm build
dsh plugin --profile <profile> add C:\path\to\dsh-composition-doctor
dsh plugin --profile <profile> remove dsh-composition-doctor
```

命令行也可直接运行 `node dist/cli/main.js`（或 `pnpm dsh-doctor`）。

### 使用

```powershell
dsh-doctor scan --profile .\test\fixtures\healthy --format both --output .\reports\healthy
dsh-doctor snapshot --profile .\test\fixtures\healthy --output .\reports\before.json
dsh-doctor diff --before .\reports\before.json --after .\reports\after.json --format both
dsh-doctor preflight --profile .\test\fixtures\preflight-real-profile --target-dsh 0.1.0-rc.6 --candidate example-plugin@2.0.0
```

`--online` 只记录用户明确选择在线适配器的意图；当前实现仍不调用网络。`--allow-build` 是显式闸门，当前版本没有第三方构建 runner，因此不会执行生命周期脚本。

### 输出示例

```text
warning  runtime-composition-unavailable
  evidence: cordis.yml (static)
  explanation: 未注入公开的 resolved-composition provider，静态 YAML 不能证明运行时加载结果。
  remediation: 在隔离 fixture 中提供公开 provider 后重跑。
```

完整示例见 [`docs/examples/scan-report.md`](docs/examples/scan-report.md)。

### 权限与隐私边界

默认只读，只读取显式 profile 根目录的 `cordis.yml`、`cordis.patch.yml`、`package.json` 和 lockfile 元数据，并拒绝符号链接。不会读取 `.env`、密钥、token、环境变量值、会话正文或工作区文件内容，不联网，不安装/卸载/迁移，不切换权限模式。快照递归脱敏敏感字段并只保留结构摘要与 SHA-256。工具不提供“安全评分”，也不声称插件本身安全。

### 支持范围与限制

当前验证过的开发预览范围：DSH `>=0.1.0-rc.5 <0.2.0`、Cordis `>=4 <5`、Node `>=20`，Windows 优先且可在 macOS/Linux 使用。DSH 尚未公开稳定的 resolved composition introspection API；未注入 provider 时结果明确标记为 static，不能证明启动成功或失败。Settings 页面依赖公开 `settings.plugins.tab` slot，不使用私有图标或 loader API。

## English

`dsh-composition-doctor` is a local, read-only composition and upgrade preflight plugin for DeepSeek Harness. It analyses an explicitly selected profile, reports evidence-backed Cordis and plugin risks, snapshots redacted metadata, diffs snapshots, and rehearses upgrades in an isolated temporary directory. It never edits a real profile, installs or removes plugins, changes permissions, reads `.env`/keys/tokens/session/workspace contents, or performs network I/O by default. Findings are `info`, `warning`, or `error`; incomplete evidence is a warning, not a confirmed failure.

Commands are `dsh-doctor scan`, `snapshot`, `diff`, and `preflight`; invocation examples are above. The Web Settings section is display/export only. Verified preview range: DSH `>=0.1.0-rc.5 <0.2.0`, Cordis `>=4 <5`, Node `>=20`. Runtime composition introspection is an injected public-provider boundary; static findings are labelled accordingly. See [`docs/compatibility.md`](docs/compatibility.md) and [`docs/examples/scan-report.md`](docs/examples/scan-report.md).

## Development

```powershell
pnpm test
pnpm typecheck
pnpm build
```

Fixtures under `test/fixtures` cover healthy, duplicate row id, hook order, UI conflict, peer mismatch, redaction, and preflight isolation cases.
