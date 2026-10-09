# 0.4.0 Adoption & Distribution — 审核包

观察日期：2026-10-09（Asia/Shanghai）。本轮仅准备本地文档、宣传资产与市场更新补丁；没有推送、对外发帖、第三方 PR、合作邀请或 npm 发布。

优先解决已发布 0.4.0 与 README「未发布 RC」之间的矛盾，降低试用成本；更新已有市场条目；以一条真实故障模式和有价值的反馈邀请带来试用。下载增长不能当作用户增长。

| 交付 | 内容 |
|---|---|
| [渠道与竞品分析](channels.md) | 当前收录、同步链路、重复投稿核查与合作对象 |
| [市场 PR 草稿](marketplace-pr.md) | 已有 Awesome 条目的单文件更新补丁；dsh-plugin.org 编辑请求 |
| [中英文社区内容](community.md) | 官方 #8891 补充、相关讨论技术回复、合作邀请，均未发送 |
| [25 秒 Demo](../demo/failure-explainer.gif) | 已发布 npm CLI 在公开模式 fixture 上的真实输出渲染；[证据](../demo/adoption-capture.json) |
| [公开指标账本](metrics.md) | 下载、使用案例、Star、Issue、社区引用分开记录，无遥测 |
| [14 天执行计划](plan-14-days.md) | 2026-10-09 至 10-22，审核通过后执行外部动作 |
| [发布状态核验](../release-evidence/0.4.0-published.md) | registry、artifact SHA-256、既有发布/宿主验收记录的有限范围 |

## 待审核的具体动作

1. 推送本地分支 `codex/adoption-distribution-040` 的 README、CHANGELOG、文档、Demo、`screenshots.json`、使用反馈模板与三个离线/公开指标脚本；创建自有仓库文档 PR。版本号和产品实现不变。
2. 将 GitHub Description 改为：`Explain DSH plugin failures: duplicate inserts, missing patches, peer mismatches and their source paths. Read-only CLI; offline by default.` 可保留现有四个 topics，另加 `cli`、`diagnostics`、`developer-tools`。这项仓库设置尚未修改。
3. 向 Awesome 提交 [现有条目更新 PR](marketplace-pr.md)。先让新 README/GIF 可从公共 main 访问，再提交。再次查询同项目开放 PR；已有相同更新时直接延续，避免重复。
4. 在 [官方 #8891](https://github.com/deepseek-ai/deepseek-harness/discussions/8891) 补充 [中英文技术示例](community.md)，不另开重复发布帖。dsh-plugin.org 走现有收录的编辑反馈；不重填新插件提交表。
5. 相关故障回复和合作邀请分别审核、按相关性选择。最多先选一个讨论和一个维护者，避免把相同内容铺到多个旧帖。

## 边界与验证

仓库起点为 `b8b25bf0ea54bcf4455066d40d49f8cffab18a74`，与远程 main 一致。npm `latest` 是 0.4.0，DSH `latest` 是 0.2.0-rc.2，alpha 已变为 0.2.1-alpha.2；alpha 没有本轮验证，不能纳入兼容承诺。

Demo 使用 registry 下载的 0.4.0 tarball，SHA-256 与此前发布记录一致；在独立目录安装，禁用 lifecycle scripts。两个 fixture 诊断 exit 0；未支持的 Web RPC 日志对健康 fixture 返回 `no-match / unknown`。没有复制真实用户 profile，没有运行 DSH 或第三方插件 runtime。

原始网页、市场 checkout、npm cache 和安装目录放在忽略的 `rc-artifacts/adoption/`，不进入交付补丁。公开文档只保留来源、必要摘要和可审核的输出。指标脚本 GitHub API 被限流时写 `null` 和错误，不把未知写成 0。

本次 Windows sandbox 拒绝 Node 异步 `realpath`；只读 fixture CLI 核验经权限工具允许后运行。没有为绕过环境限制修改产品安全判断。最终检查结果见 [validation.md](validation.md)。
