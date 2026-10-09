# Adoption asset validation — 2026-10-09

资产准备阶段没有产品实现改动或新 npm 版本。10-09 owner 批准后，已推送 main、提交市场 PR 并发布两条相关社区回复；外部执行结果见 [执行记录](execution-2026-10-09.md)。

## 实际执行的检查

- registry 0.4.0 tarball 下载、SHA-256 对比：`a8ec2adfb89239bc7b4e828695415cdb72e761a6bf415b450e8a67d0046d9bd3`，与原发布记录一致。
- 独立目录 `npm install <downloaded-tarball> --ignore-scripts --package-lock=false --no-audit --no-fund` 成功；使用 workspace 内 cache，没有全局安装或改真实 profile。
- npm 生成的 Windows `dsh-doctor.cmd` shim 输出版本 0.4.0，`check` 在公开 duplicate fixture 上成功。捕获脚本对两个公开模式运行已安装 CLI 的 human/JSON/Markdown，均成功；unsupported Web RPC control 返回 no-match/unknown。
- `pnpm exec vitest run test/readme-examples.test.ts test/failure-explainer.test.ts test/cli-entrypoint.test.ts test/profile-mutation.test.ts`：**4 个文件 / 54 项通过，0 失败、0 跳过**。范围是文档命令与双语标题、故障解释与负例、CLI launcher、profile 只读边界。未声称重跑完整跨平台或真实 DSH 宿主矩阵。
- 换成真实 Desktop GIF 后，再运行 `pnpm exec vitest run test/readme-examples.test.ts`：**2 项通过**；重新校验所有本地链接、六帧各自 SHA-256 和 25 秒总时长，并查看完整逐帧联系表和原尺寸 poster。
- YAML 解析和 scope 检查：目标 url/name/category 不变，双语 description 是唯一内容变化。对市场 checkout `17ae18761c0f8b1107f92714f50e633929d24c2e` 执行 `git apply --check` 成功。目标的完整 CI、维护者审核和合并尚未发生。
- 公共指标脚本写出 [真实快照](2026-10-09-metrics.json)：npm endpoints 成功；GitHub 403 原样记录，并保留 null。没有把未知 Issue 数写成 0。
- 本地资产校验：检查新文档/README 的所有相对文件链接、两张真实 Desktop 截图 PNG 与 manifest、GIF 6 帧总时长 25,000ms、捕获文本版本/exitCode/static/runtime-unknown/no-mutation 标注。逐帧人工视觉核验字幕、来源字段、未知边界和手动下一步；原 UI 的长 pre 行仍会横向溢出，随后 row 详情画面分别完整显示两份 source，不重绘或伪造 UI。
- `git diff --check`；以及 `git diff --exit-code -- package.json pnpm-lock.yaml src test .github/workflows/ci.yml`，确认版本、产品、测试 fixture 和 CI 未改。

GIF 于 10-09 通过真实 Desktop 0.2.0-rc.2 的公开设置页面截取，Doctor 已启用并显示 0.4.0。展示的是 10-04 已生成的脱敏 duplicate fixture 报告；核对当前配置 reportDir 对应 report.json 与旧验收备份 SHA-256 相同（8c69da0b99d92cc01e255b849ec0cc900b218f87de03de952cbbfc757352c3d9）。六个实际 UI 状态按阅读停留剪成 25 秒，裁切只去掉外部私人侧栏；字幕位于原 UI 外，不替换产品像素。没有改宿主配置、插件开关，没有假造用户成功案例或自动修复结果。这次仅重看报告与来源交互，不宣称重跑全部 Desktop 生命周期。

## 尚待外部核验

公共 main 的中英文 README、screenshots.json 与 GIF 已回读确认 HTTP 200 且内容一致，资产提交的远程 CI 通过。市场 screenshot crawler、条目合并和下游同步仍需在实际发生后核查；市场 PR 尚未合并。候选合作邀请仍未发送。

原 npm 0.4.0 artifact 含旧版 README 状态文字，本轮不重新发布同版本、不发布新版本。仓库 About Description/topics 已按 [审核包](README.md) 更新并回读确认。
