# 公开指标与真实使用账本（无遥测）

主要观察的是“尝试诊断→理解来源或 unknown→下一步人工验证”，不通过埋点追踪用户。公开记录汇总数量和可核查链接，用户自愿提供的公开案例才进入使用账本。不收集设备标识、IP、私有配置或真实日志。

## 2026-10-09 基线

| 指标 | 数值 / 状态 | 含义与来源 |
|---|---|---|
| npm 7 日下载 | 514，2026-10-02…10-08 | [npm 公共 API](https://api.npmjs.org/downloads/point/2026-10-02:2026-10-08/dsh-composition-doctor)，完整 UTC 日窗口；跨包版本，不是 0.4.0 的用户数 |
| npm 30 日下载 | 1,963，2026-09-09…10-08 | [npm 公共 API](https://api.npmjs.org/downloads/point/2026-09-09:2026-10-08/dsh-composition-doctor)，不等于安装成功或留存 |
| GitHub Star | 1 | [仓库公共页面](https://github.com/lemonxiny55/dsh-composition-doctor)，Awesome 当日目录亦为 1；不是活跃用户或质量评级 |
| 公开外部试用案例 | 1 个可核查线索 | #9044 明确使用 0.4.0 并记录 no-match；用户自述，未独立复测其环境 |
| 成功辅助定位案例 | 0 个已核实 | 不把 fixture、维护者 smoke、范围外排查或下载当成功；并不表示无人受益，只是暂无公开证据 |
| 自有 repo Issue | 本轮 API 获取不可用 | GitHub API 403 限流，保留未知。dsh-plugin.org 10-06 页面显示 0，只是陈旧交叉参考；不能作为当日精确 Issue 数 |
| 官方公告回复 | 0（查看时） | [#8891](https://github.com/deepseek-ai/deepseek-harness/discussions/8891)，不算一条用户反馈 |
| 独立社区引用 | 1 个已找到链接 | #9044 同时是引用与试用；两个维度重叠，不相加成两名用户。未证明全网只有这一条 |
| 维护者验证 | 本轮 1 次 npm 包试装、两个 fixture + 一个 control | 明确排除为外部使用。registry tarball 请求会影响下载统计，无法可靠逐条扣除 |

[原始汇总快照](2026-10-09-metrics.json)。GitHub API 的 `open_issues_count` 包含 PR，不能直接标成 Issue 数；可读时按公开 issues/PR 页面或单独查询拆开。没有返回的数据用 `null/不可用`，不能填写 0。

10-09 宣传执行后，使用现有 GitHub 登录回读确认 Star 仍为 **1**、自有 open Issue **0**（此时无开放 PR）。这是后续观察，历史未认证快照的 null 不改写。已提交一条市场更新 PR、发布两条维护者回复；它们不算新增外部使用或独立引用。实际 URL 见 [执行记录](execution-2026-10-09.md)。

## 使用案例账本

| ID | 日期 / 来源 | 证据 | Doctor 结果 | 人工结果 | 统计类别 |
|---|---|---|---|---|---|
| U001 | 2026-10-06，[DSH #9044](https://github.com/deepseek-ai/deepseek-harness/discussions/9044) | 作者 1837zzy-max 公开记录 0.4.0 command/output；外部自述，未复测 | `no-match / unknown` | 用户自行定位 Config=null 的 runtime 问题；Doctor 没有解释根因。no-match 不排除配置或 runtime 错误 | 外部试用 1；成功辅助定位 0；社区引用 1 |

后续按唯一问题/环境/复现归并，不把同一个案例在 Issue 和 Discussion 的交叉贴算成两个案例。分清 `explained+人工确认有帮助`、`explained+未确认`、`unknown/no-match`、`运行/安装失败`。与错误 symptom 同名但无元数据支持仍是 unknown。

“有帮助”需要用户公开说明哪条来源/建议改变了人工检查，以及检查结果；维护者 fixture 自测不能填进这个类别。不把未经授权的对话、合作回复或市场安全标签当评价。

## 轻量维护方式

每周两次（首周 10-12、10-15；次周 10-19、10-22）抓取公开聚合统计，每次只增加一份快照和一行汇总，不部署服务或 GitHub Actions：

```sh
node scripts/adoption-metrics.mjs 2026-10-12 docs/adoption/2026-10-12-metrics.json
```

脚本仅 GET npm/GitHub 公共元数据，不读 profile 或日志，不上传。日期是观察者本地日历日期，npm 窗口按其 API 的 UTC 日计算。脚本不会访问 profile，不会自动发现使用案例、发帖、推送或创建定时任务。

人工每次用项目全名检查官方 Discussions、repo Issues 与已知市场更新，逐条补链接和 outcome。限定这几个渠道，不搜集私人用户画像。现有公开 Star 可看绝对量和净变化；仅 1 个 Star 时不计算夸大的增长百分比。下载量只看同期窗口方向，不对它计算“真实用户转化率”。

| 观察日 | 7 日下载 | 30 日下载 | Star | 新外部案例 / 有帮助 | 自有 Issue（去掉 PR） | 新独立引用 | 已批准动作 / 维护者验证 |
|---|---:|---:|---:|---|---|---|---|
| 2026-10-09 | 514 | 1,963 | 1 | 基线 1 / 0 | 不可用 | 基线 1 | 外部动作 0；本地试装 1 |
| 2026-10-09，分发执行后 | 未重抓 | 未重抓 | 1 | 新增 0 / 0 | 0（已认证 API 回读） | 新增 0 | main/About 已更新；市场 PR 1；维护者社区回复 2 |

默认不设置 Star 数 KPI。14 天争取新增两个可复查的外部反馈，其中至少一个能说明下一步检查是否有帮助；这是学习目标，不承诺达成。没有真实反馈时如实记录 0/未知，不能用下载代替。
