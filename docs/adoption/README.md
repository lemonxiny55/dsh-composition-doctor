# 0.4.0 Adoption & Distribution — 审核包

观察日期：2026-10-09（Asia/Shanghai）。owner 已批准开始宣传；自有 main、About、Awesome 更新 PR、官方 Demo 回复和真实试用边界澄清已执行。实际 URL、验证及待同步状态见 [执行记录](execution-2026-10-09.md)。未发布 npm、未发送合作邀请。

优先解决已发布 0.4.0 与 README「未发布 RC」之间的矛盾，降低试用成本；更新已有市场条目；以一条真实故障模式和有价值的反馈邀请带来试用。下载增长不能当作用户增长。

| 交付 | 内容 |
|---|---|
| [渠道与竞品分析](channels.md) | 当前收录、同步链路、重复投稿核查与合作对象 |
| [市场更新](marketplace-pr.md) | Awesome [PR #6965](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/6965) 待审核；dsh-plugin.org 更正草稿保留 |
| [中英文社区内容](community.md) | #8891 中英文补充与 #9044 澄清已发布；其他候选回复和邀请未发送 |
| [25 秒 Demo](../demo/failure-explainer.gif) | 真实 DSH Desktop 0.2.0-rc.2 中查看 Doctor 0.4.0 fixture 报告；[录制证据](../demo/desktop-capture.json) |
| [公开指标账本](metrics.md) | 下载、使用案例、Star、Issue、社区引用分开记录，无遥测 |
| [14 天执行计划](plan-14-days.md) | 2026-10-09 至 10-22，审核通过后执行外部动作 |
| [发布状态核验](../release-evidence/0.4.0-published.md) | registry、artifact SHA-256、既有发布/宿主验收记录的有限范围 |

## 已批准范围与后续边界

1. 按 owner 选择，已将本地两个资产提交快进合并并推送至自有 `main`，没有开自有仓库 PR。版本号和产品实现不变；合并后的本地宣传分支已删除。
2. GitHub Description 已采用：`Explain DSH plugin failures: duplicate inserts, missing patches, peer mismatches and their source paths. Read-only CLI; offline by default.` 保留原四个 topics，增加 `cli`、`diagnostics`、`developer-tools`。
3. 再次核查最新 upstream 和开放 PR 后，已提交 Awesome [现有条目更新 PR #6965](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/6965)。继续核查审核与同步，不向 dsh-market 重复投稿。
4. 已在官方 #8891 补充一条中英文技术示例。dsh-plugin.org 先等待现有详情同步，必要时更正一次，不重填新插件提交表。
5. 已选择 #9044 澄清真实试用的 no-match 边界；未向其他旧帖广播。合作邀请继续保留为候选，未发送。

## 边界与验证

仓库起点为 `b8b25bf0ea54bcf4455066d40d49f8cffab18a74`，与远程 main 一致。npm `latest` 是 0.4.0，DSH `latest` 是 0.2.0-rc.2，alpha 已变为 0.2.1-alpha.2；alpha 没有本轮验证，不能纳入兼容承诺。

Demo 使用 registry 下载的 0.4.0 tarball，SHA-256 与此前发布记录一致；在独立目录安装，禁用 lifecycle scripts。两个 fixture 诊断 exit 0；未支持的 Web RPC 日志对健康 fixture 返回 `no-match / unknown`。CLI fixture 捕获没有运行 DSH 或第三方 runtime。桌面 GIF 另于 10-09 操作真实 Desktop 的既有 Doctor 页面，展示 10-04 生成的脱敏 fixture 报告；没有改 profile 或插件开关，没有将 fixture 诊断当作当前真实故障的诊断。

原始网页、市场 checkout、npm cache 和安装目录放在忽略的 `rc-artifacts/adoption/`，不进入交付补丁。公开文档只保留来源、必要摘要和可审核的输出。指标脚本 GitHub API 被限流时写 `null` 和错误，不把未知写成 0。

本次 Windows sandbox 拒绝 Node 异步 `realpath`；只读 fixture CLI 核验经权限工具允许后运行。没有为绕过环境限制修改产品安全判断。最终检查结果见 [validation.md](validation.md)。
