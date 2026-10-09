# 2026-10-09 宣传执行记录

时区：Asia/Shanghai。owner 已批准开始宣传，并选择直接在自有仓库 main 发布。最后核查时间：2026-10-09 20:51。

| 动作 | 已核查结果 |
|---|---|
| 自有仓库资产上线 | 两次已审核提交快进合并至 main，最新资产提交 [2978c30](https://github.com/lemonxiny55/dsh-composition-doctor/commit/2978c30ce348b1563ed5565194214fb527a599e0)。已删除合并后的本地宣传分支；没有创建自有仓库 PR。 |
| README / Demo | 中英文 README、screenshots.json、[真实 Desktop GIF](https://raw.githubusercontent.com/lemonxiny55/dsh-composition-doctor/main/docs/demo/failure-explainer.gif) 均 HTTP 200。文本规范换行后与本地一致；GIF 898,232 bytes，SHA-256 `f07d107d64b2dff0353739d354fad67c38013e0775beea34a5bbfc498d533b7a` 与本地逐字节相同。 |
| GitHub About | Description 已改为 `Explain DSH plugin failures: duplicate inserts, missing patches, peer mismatches and their source paths. Read-only CLI; offline by default.` 保留原 topics，增加 cli、diagnostics、developer-tools，API 回读确认。 |
| Awesome 更新 | [PR #6965](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/6965) 已提交，OPEN、非 draft。只改现有 YAML 的两行中英文 description；未新增条目或改生成 README。检查仍 QUEUED，尚未合并。目标起点 `17ae18761c0f8b1107f92714f50e633929d24c2e`，更新提交 `676597415bf15576eb86945fedb99c24e6eceaa7`。 |
| 官方公告补充 | 在既有 [#8891 发布一条中英文回复](https://github.com/deepseek-ai/deepseek-harness/discussions/8891#discussioncomment-18835280)：真实 Desktop Demo、独立 CLI 试用、unknown 边界和自愿反馈入口。英文折叠展示，只出现一次 GIF。API 回读正文与审核稿一致。 |
| 真实试用范围澄清 | 在 [#9044 回复一次](https://github.com/deepseek-ai/deepseek-harness/discussions/9044#discussioncomment-18835281)，澄清 no-match 不排除配置/runtime 故障，并承认 Config=null 是原作者独立定位。没有追加安装广告或要求 Star。API 回读正文一致。 |
| 自有资产 CI | [CI 37932033671](https://github.com/lemonxiny55/dsh-composition-doctor/actions/runs/37932033671) completed / success，针对资产提交 2978c30。 |

## 效果口径

执行后 API 确认 GitHub Star **1**、自有 open Issue **0**（仓库此时没有开放 PR）。此前公开未认证 API 被限流的快照保留原来的 null；不改写历史。

外部可核查试用仍为 **1**，已确认有帮助的根因定位仍为 **0**，独立社区引用仍为 **1**。今天两条维护者回复不算外部用户反馈或独立推荐；市场 PR 提交不等于已合并或已完成同步。没有以宣传完成推断下载、安装成功、用户增长或 Star 增长。

## 后续

- 等待 Awesome 检查/维护者审核；有具体反馈再补充，避免重复开 PR。
- Awesome 合并后检查在线目录与 dsh-market 实际卡片。dsh-plugin.org 已收录，先等待其正常同步周期；仍旧时只反馈一次既有详情更正，不重投新插件。
- 10-12、10-15、10-19、10-22 按 [指标账本](metrics.md) 记录下载、Star、Issue、真实案例与独立引用。当前没有启动后台定时任务。
- 合作邀请未发送；没有向旧故障帖群发示例，没有发布 npm 版本。
