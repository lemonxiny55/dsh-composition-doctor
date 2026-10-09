# Adoption asset validation — 2026-10-09

本轮没有产品实现改动，没有新 npm 版本、外部帖子、第三方 PR 或推送。

## 实际执行的检查

- registry 0.4.0 tarball 下载、SHA-256 对比：`a8ec2adfb89239bc7b4e828695415cdb72e761a6bf415b450e8a67d0046d9bd3`，与原发布记录一致。
- 独立目录 `npm install <downloaded-tarball> --ignore-scripts --package-lock=false --no-audit --no-fund` 成功；使用 workspace 内 cache，没有全局安装或改真实 profile。
- npm 生成的 Windows `dsh-doctor.cmd` shim 输出版本 0.4.0，`check` 在公开 duplicate fixture 上成功。捕获脚本对两个公开模式运行已安装 CLI 的 human/JSON/Markdown，均成功；unsupported Web RPC control 返回 no-match/unknown。
- `pnpm exec vitest run test/readme-examples.test.ts test/failure-explainer.test.ts test/cli-entrypoint.test.ts test/profile-mutation.test.ts`：**4 个文件 / 54 项通过，0 失败、0 跳过**。范围是文档命令与双语标题、故障解释与负例、CLI launcher、profile 只读边界。未声称重跑完整跨平台或真实 DSH 宿主矩阵。
- YAML 解析和 scope 检查：目标 url/name/category 不变，双语 description 是唯一内容变化。对市场 checkout `17ae18761c0f8b1107f92714f50e633929d24c2e` 执行 `git apply --check` 成功。目标的完整 CI、维护者审核和合并尚未发生。
- 公共指标脚本写出 [真实快照](2026-10-09-metrics.json)：npm endpoints 成功；GitHub 403 原样记录，并保留 null。没有把未知 Issue 数写成 0。
- 本地资产校验：检查新文档/README 的所有相对文件链接、两张截图 PNG 与 manifest、GIF 5 帧总时长 25,000ms、捕获文本版本/exitCode/static/runtime-unknown/no-mutation 标注。逐帧人工视觉核验标题、来源路径、未知边界和手动下一步无裁切。
- `git diff --check`；以及 `git diff --exit-code -- package.json pnpm-lock.yaml src test .github/workflows/ci.yml`，确认版本、产品、测试 fixture 和 CI 未改。

GIF 是实际 stdout 和标明的 exact excerpts 的文字渲染；wrap/着色/标题是呈现层。PNG 保留完整 stdout，文本文件只规范末尾换行。没有假造 DSH runtime、用户成功案例或自动修复结果。

## 尚待外部核验

新资产推到公共 main 后，才可以检查 GitHub 实际 README 显示、市场 screenshot crawler 和同步结果。当前本地链接存在不等于这些公共 URL 已上线。第三方 PR 与帖子继续保留为待审核草稿。

原 npm 0.4.0 artifact 含旧版 README 状态文字，本轮不重新发布同版本、不发布新版本。仓库 About Description/topic 设置也尚未修改；拟采用文本见 [审核包](README.md)。
