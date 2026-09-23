# 安全清理与失败留痕实机验收（2026-09-23）

[#5](https://github.com/Natumsol/html2figma/issues/5) 在绑定文件 `3bfxbSZ7K2URZ3Aak50Wwd`、页面 `0:1` 上分别运行正常八项和受控失败两轮。两轮使用不同的 runId、当前插件 bundle 与输入；本地报告位于被忽略的 `test-results/`，不会提交到 Git。

| 轮次 | runId 与本地报告 | 终态 | 画布处理 |
| --- | --- | --- | --- |
| 正常八项 | [`a5e0e19d-6ddc-4140-96bc-e1b0e133ec90`](../../test-results/real-figma/a5e0e19d-6ddc-4140-96bc-e1b0e133ec90/report.html) | 八项通过，清理通过 | 只移除本轮区域 `26:221` 及其 36 个子节点 |
| 受控失败 | [`2a4f36d0-7235-4c18-bc08-70773d081c23`](../../test-results/real-figma/2a4f36d0-7235-4c18-bc08-70773d081c23/report.html) | 非零退出 | 保留区域 `26:258`、已通过的 geometry 与失败的 flex-border 节点 |

正常轮的六个视觉用例及两项真实扩展下载均满足既有尺寸、警告与像素阈值。31 个有序事件显示八次任务按序完成；在第 27 个 `rendered` 事件后，先保存独立的 `report.before-cleanup.json/html`，再记录 `cleanup-authorized`、`cleanup-claimed`、`cleanup-result` 与最终 `complete`。文件时间戳证实初版报告早于清理回执。清理回执的 37 个节点 ID 与八项结果的本轮节点清单并集完全一致；顶层节点从 7 个变为 6 个，移除的恰好是本轮区域 `26:221`，其余顶层节点顺序与 ID 保持不变。八项及清理前后的 page、selection、viewport center、zoom 快照均一致。

失败轮使用 `--inject-failure-case flex-border`：插件完成 geometry 渲染后，在 flex-border 创建节点后主动抛错。报告记录 geometry 根节点 `26:259` 已通过，flex-border 新出现的 5 个节点为 `26:265` 至 `26:269`；失败快照仍能观察到这 5 个节点及 geometry 节点。命令退出码为 1，9 个有序事件止于 `plugin-failure` 和 `failure`，没有清理事件或清理产物。typography、flex-reverse、flex-absolute、media 与两项扩展用例明确列为未执行。失败前后的 page、selection 与 viewport 快照一致。失败快照是插件关闭前的观察，未额外运行关闭后的节点读取。

受控协议测试另外验证旧构建、重复领取、任务超时、迟到结果、PNG 写入失败、清理前证据写入失败、缺失节点的清理回执、无关顶层节点变动和明确清理失败均不会伪报成功或发起重复渲染。这些测试使用受控对端，不计作实机结果。`npm run verify:all` 本地及 PR CI 均通过；正常产品插件构建仍不含后台 Bridge。
