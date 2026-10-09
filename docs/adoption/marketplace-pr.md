# 值得提交的市场更新

## P0 — Awesome 现有条目更新（已提交，待审核）

实际 PR：[awesome-dsh-plugin/awesome-dsh-plugin #6965](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/6965)，10-09 经 owner 批准提交。以下保留审核正文；检查、合并和同步状态见 [执行记录](execution-2026-10-09.md)。

目标仓库：[awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)。参考起点 `17ae18761c0f8b1107f92714f50e633929d24c2e`。

目标文件：`data/plugins/lemonxiny55__dsh-composition-doctor.yml`。只改 `description.en` 和 `description.zh`；保留 url/name/category，不新增条目、不改生成 README、npm map 或安全扫描结果。

[完整最终 YAML](marketplace/entry.yml) · [可应用补丁](marketplace/awesome-040.patch)。提交前先将审定的自有 README/Demo 推到公共 main，拉取目标最新 main 并重查开放 PR；此 patch 在本轮目标 checkout 上通过 `git apply --check`，后续目标发生变化时应重新生成。

**PR title**

```text
catalog: update Composition Doctor description for the published Failure Explainer
```

**PR body（可直接使用）**

```markdown
The existing entry still describes the older scan/snapshot/preflight entry point. Composition Doctor 0.4.0 is published and adds a standalone Failure Explainer for supported DSH plugin failures, including duplicate insertions, missing bundle patches and peer mismatches.

This updates only the existing entry's English and Chinese descriptions. It preserves the development category and emphasizes observable source paths, manual next steps, default read-only/offline diagnosis and unknown runtime. It does not claim automatic repair or general runtime compatibility.

Evidence: [published npm 0.4.0](https://www.npmjs.com/package/dsh-composition-doctor/v/0.4.0), [source and public failure patterns](https://github.com/lemonxiny55/dsh-composition-doctor/blob/main/docs/failure-cases.md), [actual CLI demo and captures](https://github.com/lemonxiny55/dsh-composition-doctor/tree/main/docs/demo), and [official release Discussion #8891](https://github.com/deepseek-ai/deepseek-harness/discussions/8891).

Local validation: parsed YAML, checked identity/category and description-only scope, and verified patch applicability against 17ae18761c0f8b1107f92714f50e633929d24c2e. Marketplace CI and reviewer verification remain pending. Existing listing history: #5322 and #5415; no new listing requested.
```

提交后只记录实际 PR URL/状态。不要把一个 PR 的准备、提交和合并算作三个新增渠道，也不向 dsh-market 发相同条目 PR。

## P1 — dsh-plugin.org 既有详情更正（未发送）

该站已经列出 0.4.0，FAQ 明确说已收录项目会同步 README/元数据。先等审定文档更新后的一次刷新；仍旧才沿 [提交页面](https://dsh-plugin.org/submit) 给出的维护反馈入口发送 **existing listing correction**。没有可核查的开放源数据仓库，因此不编造第三方 PR 路径，也不重新提交新插件。

**Subject**

```text
Existing listing correction: Composition Doctor 0.4.0 Failure Explainer
```

**Body**

```text
Please refresh the existing listing for https://github.com/lemonxiny55/dsh-composition-doctor (already listed at https://dsh-plugin.org/plugins/lemonxiny55/dsh-composition-doctor).

Suggested summary: Composition Doctor 0.4.0 explains supported DSH plugin failures by linking symptoms to observable bundle/patch/profile source paths and manual next steps. Duplicate insertions, missing patches and peer mismatches are supported; unobserved runtime remains unknown. Default CLI diagnosis is read-only and offline and works without a running Web UI. There are no automatic repairs or uploads.

建议中文摘要：Composition Doctor 0.4.0 将受支持的插件故障关联到可观察的 bundle、patch、profile 来源路径与人工下一步。支持重复引入、缺失 patch 和 peer 不匹配，未观察的 runtime 保留 unknown。默认 CLI 诊断只读离线，Web UI 无法运行时也可使用；不自动修复、不上传数据。

CLI: npm install -g dsh-composition-doctor@0.4.0 --ignore-scripts
Then: dsh-doctor check --profile "<actual-profile-directory>"
Optional report viewer: dsh plugin --profile web add dsh-composition-doctor@0.4.0

The released DSH composition contract was checked on 0.2.0-rc.2. Prior Desktop UI/lifecycle checks apply specifically to Windows 11 / Desktop 0.2.0-rc.2, not all hosts or third-party runtimes. Sources: the repository README, docs/failure-cases.md, docs/demo/README.md and official Discussion #8891. No new listing or compatibility endorsement is requested.
```

其他自动目录只等待元数据同步。若新增渠道未来需要人工投稿，先证明缺失、活跃且有不同受众，再准备单独申请。
