# 市场渠道、竞品与用户需求核查

2026-10-09 检查；以下状态表示页面或数据源可读取，不代表活跃访客数、安装成功率或安全背书。搜索引擎缓存只作线索，收录判断优先用当日 upstream 数据和实际页面。

## 分发渠道

| 渠道 | 实际情况与证据 | 最有效动作 | 优先级 |
|---|---|---|---|
| [Awesome DSH Plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) | 已有 `data/plugins/lemonxiny55__dsh-composition-doctor.yml`，分类 `dev`。当日 checkout `17ae18761c0f8b1107f92714f50e633929d24c2e` 的中英文介绍仍以 scan/snapshot/preflight 为主。在线 [plugins.json](https://awesome-dsh-plugin.com/plugins.json) 已识别 npm 0.4.0，却仍用旧介绍。 | 更新这个现有 YAML 文件的两条 description；不再申请收录，不手改生成 README。 | P0 |
| [dsh-market](https://github.com/dsh-market/dsh-market#submit-your-plugin) / [市场详情](https://dshmarket.com/p/lemonxiny55/dsh-composition-doctor/) | 已收录；upstream README 明确市场读取 Awesome 在线目录，条目 PR 应发 Awesome。新 README 支持截图提取和仓库 `screenshots.json`。 | 同一个 Awesome PR 改善发现；自有仓库截图声明改善展示。更新后检查在线目录、网站和实际市场卡片，不能把“同步机制”写成“已完成同步”。 | P0，随上游 |
| [dsh-plugin.org 详情](https://dsh-plugin.org/plugins/lemonxiny55/dsh-composition-doctor) | HTTP 200，列出 v0.4.0；页面标示 2026-10-06 更新，独立改写摘要仍强调升级前扫描，未突出 Failure Explainer。它的“Verified”是该站标签，不是我们的兼容承诺。 | 先更新 README/Description，按 [submit FAQ](https://dsh-plugin.org/submit) 的定期同步机制观察一轮。仍过期时向既有编辑反馈通道提交更正，不重投新条目。 | P1 |
| [lwmxiaobei/dsh-plugins](https://github.com/lwmxiaobei/dsh-plugins/blob/main/README.en.md) / dsh-plugins.org | 当日原始 README 中已有条目，2026-10-09 更新；描述来自仓库 About，仍为旧内容。 | 改自有 GitHub Description，等目录同步；生成表格不值得手工 PR。 | P1，低成本 |
| [bruc3van/awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin/blob/main/catalog/developer-tools.md) | 已在开发者工具分册中收录，1 Star、MIT、2026-10-05；首页强调用例、完整目录和作者展示，当前也有人工审核队列。 | 自有 Description 更新后检查同步；首轮不追加相同收录 PR，也不为了入选精选夸大能力。 | P2 |
| [dsh.so 正确详情路由](https://www.dsh.so/artifact/dsh-composition-doctor/) | HTTP 200，Composition Doctor 已有页面。旧 `/plugins/owner/repo` 路由 404，不能据此判定未收录。 | 先等自有元数据更新，必要时纠正既有详情；无需新投稿。 | P2 |
| [dsh.directory 尝试的详情路由](https://dsh.directory/plugins/lemonxiny55/dsh-composition-doctor) | 返回 “Plugin unavailable.”。这只能确认该路径当前不可用，不能证明全站未收录或不活跃。 | 暂缓；先确定其当前发现、维护和提交机制，再决定是否值得申请。 | P2，待核查 |

**不要把这些渠道当作独立获客数量相加。** Awesome → 网站 → dsh-market 是明确的共享数据链；多个自动目录也都从 GitHub topic/Description/README 取得内容。优化源头比遍历站点群发更划算。

去重记录：GitHub 当日带完整项目名的开放 PR 查询显示 **Open 0 / Closed 3**。既有 [#5322 收录](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/5322) 和 [#5415 介绍更新](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/5415) 已合并；[#5321](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/5321) 关闭未合并。准备更新而非新条目；提交前再检查开放 PR 和最新文件，搜索结果不能作为永久无重复保证。

本轮不请求删除市场扫描器给出的 `shell/fs-write/network/env` 权限标记。CLI 的默认 diagnose 只读离线与整个包中存在显式报告写入、公开 CLI 调用和 opt-in 在线 preflight 并不矛盾；只解释上下文，不伪装为全包“零能力”。

## 相近项目怎样解释价值

以下来自项目自己的 README，未对它们做安装或安全评测。竞品亦可能是合作对象；同名 npm 包必须按 owner/repository 分清。

| 项目 | 定位与传播方式 | 对 Composition Doctor 的启发 |
|---|---|---|
| [zoahdev/dsh-plugin-doctor](https://github.com/zoahdev/dsh-plugin-doctor) | 面向插件作者的 manifest/patch/build/pack/安装检查，有 CLI 和 agent tool，引用官方 RFC 和真实故障；另有 [操作教程](https://github.com/zoahdev/dsh-tutorials/blob/main/en-06-doctor.md)。 | 用可运行案例和公开问题建立需求；可以互链“包发布前检查”与“已安装 profile 来源诊断”。不要宣称只有我们能诊断。 |
| [Xrainsmile/DSH-Plugin-Doctor](https://github.com/Xrainsmile/DSH-Plugin-Doctor) | 包级检查、临时宿主安装/启动、权限审计和回滚，README 给出完整命令及证据边界。 | 明确我们的优势是启动 UI 不可用时也能做默认静态来源诊断；不借用其 runtime、回滚或安全审计能力。 |
| [moonquake2004/dsh-doctor](https://github.com/moonquake2004/dsh-doctor) | CLI 与 Web 报告入口；围绕宿主/配置健康的实际问题解释检查结果。 | 名称相近，首屏必须写清 package `dsh-composition-doctor`、CLI `dsh-doctor`、owner。不要指引用户安装另一项目的包。 |
| [dsh-market](https://github.com/dsh-market/dsh-market) | 首屏截图、短安装命令、具体操作入口、清晰反馈路由；插件卡片可展示作者截图。 | 加 GIF/PNG 与截图 manifest，将“浏览→试用→反馈”压缩到少量步骤；合作切口是故障时来源解释，不再开发市场集成。 |
| [Awesome 主列表](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) | 分类别、双语、协议和可安装性检查，强调描述准确。 | 投稿写功能和边界；一个有证据的更新 PR 足够，不用夸张卖点、排行榜诉求或重复投稿。 |

这些观察解释可借鉴的呈现方式，**不能推断这些方式带来了多少 Star**。本轮不做依赖流量不可见的渠道 ROI 精确估计。

## 真正相关的讨论与合作切口

| 讨论 / 对象 | 需求与当前状态 | 建议 |
|---|---|---|
| [官方 #8891](https://github.com/deepseek-ai/deepseek-harness/discussions/8891) | 2026-10-05 已发中英文 0.4.0 公告，查看时 0 回复。 | 更新原线程：Demo、标准 profile 路径、什么反馈有用，避免再开发布帖。 |
| [#2889，taonokenshin](https://github.com/deepseek-ai/deepseek-harness/discussions/2889) | bundle 与手写 insert 重复加载，有来源/配置证据和技术回复；2026-08 的旧故障。 | 作为 Demo 来源很强。只有新增最小 fixture 对诊断路径有帮助时才补充一次；不能宣称最新 DSH 仍必现此旧 bug。 |
| [#6539，profile composition drift](https://github.com/deepseek-ai/deepseek-harness/discussions/6539) | 需求直接是 UI 无法启动时的 profile doctor；含包缺 patch、target 缺失讨论。 | 最贴合用户痛点；技术回复应区分缺包、缺 patch 与看不到其他层，附 fixture，避免重复贴安装广告。 |
| [#8199，wzn16 / Bruce-Yii](https://github.com/deepseek-ai/deepseek-harness/discussions/8199) | 2026-09-29 升级 peer gate 与 release-age 安装策略问题。 | 可解释静态 peer range，但不能解决 release-age、猜可用版本或绕开宿主 gate。若要回复，只补这一限定结论。 |
| [#9044，1837zzy-max](https://github.com/deepseek-ai/deepseek-harness/discussions/9044) | 2026-10-06 外部用户已运行 0.4.0；Doctor 返回 no-match，用户另行定位 Config=null 的 runtime 问题。 | 首个可核查的外部试用线索；优先澄清 no-match 不排除配置/runtime 问题。不要当成功案例宣传，也不要要求重复试用。 |
| Awesome / dsh-market 维护者 | 能用现有条目和截图把工具递给处于安装/升级场景的用户。 | 本轮先提准确条目更新；后续可提文档互链，不要求开发新集成功能。 |
| zoahdev | 作者工具、教程与 profile doctor 范围有交集，故障素材丰富。 | 一封具体、可拒绝的 fixture/文档互链邀请；先审核再联系。不索求 Star 或背书。 |

首轮采用：仓库入口 + 一个 Awesome 更新 + 官方原线程补充。相关讨论最多先选 #9044 的范围澄清或 #6539 的复现补充之一，依据对话是否仍需要该信息决定；不同时投放所有草稿。
