# 两轮八项真实 Figma 后台验收（2026-09-24）

[#6](https://github.com/Natumsol/html2figma/issues/6) 在绑定文件 `3bfxbSZ7K2URZ3Aak50Wwd`、页面 `0:1` 上完成两轮独立八项运行，并核对连接不可用与用例失败的真实退出结果。第一轮使用后来由 [PR #10](https://github.com/Natumsol/html2figma/pull/10) 合并的清理实现；第二轮在该合并后的 `master` 上执行，期间只有运行指南变更，没有插件运行时代码变更。产物位于被忽略的 `test-results/`，以下本地报告链接只在本工作区有效。

| 轮次 | runId 与本地报告 | 插件 bundle SHA-256 | 输入集合 SHA-256 | 本轮区域 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 第一轮 | [`a5e0e19d-6ddc-4140-96bc-e1b0e133ec90`](../../test-results/real-figma/a5e0e19d-6ddc-4140-96bc-e1b0e133ec90/report.html) | `a74eb948c1c58f65fde7832ac2e9afb30d3969a6f41099dc531ef63f627c78a6` | `3e285a3bf12c08d9d6502db639a445ab78982bebb4350bd4b73af9ab8dbffe02` | `26:221` | 八项通过，清理通过 |
| 第二轮 | [`4ddd5071-d45f-43b7-a331-8f3afc915e47`](../../test-results/real-figma/4ddd5071-d45f-43b7-a331-8f3afc915e47/report.html) | `a34ec2896fe763732413c9eb19ffb86632181806a724eff6b299a4d5f5d622c8` | `294c969fd3dba18b1c77fe3357301abbddf012e847b3154974317e488a2df834` | `29:270` | 八项通过，清理通过 |

两轮各有八张新生成的浏览器 PNG、八张真实 Figma 导出 PNG、两份扩展下载 JSON、八份结果及独立报告。八项顺序为 geometry、flex-border、typography、flex-reverse、flex-absolute、media、extension-page、extension-selection；两轮各有一轮握手、八次领取、八次结果回传，31 个连续编号事件，没有重复渲染或未执行项。根节点 ID 集合互不相交；两轮插件 bundle 与输入集合哈希不同，不是旧图或重复握手。扩展下载 JSON 与插件回传的文档字符串一致。

每轮的尺寸、颜色阈值 0.2、各自最大差异像素比例及精确警告均通过：flex-reverse、flex-absolute 各恰好一条 `flex-layout-fallback`，其余六项零警告。八项结果和清理回执记录的 page、selection、viewport center、zoom 前后相同。每轮先保存独立的 `report.before-cleanup.json/html`，再授权清理；初版报告文件时间戳均早于清理回执。两轮各删除恰好 37 个本轮清单中的节点，`topLevelAfter` 仅比 `topLevelBefore` 少本轮区域，其他顶层节点顺序与 ID 不变。第二轮的选区与 media Figma PNG 已人工检查，内容清晰且不为空白。

故障证据分别来自 [连接超时轮 `bb7eb217-e3bd-40ba-aba5-da11848cd457`](../../test-results/real-figma/bb7eb217-e3bd-40ba-aba5-da11848cd457/report.html) 和 [受控用例失败轮 `2a4f36d0-7235-4c18-bc08-70773d081c23`](../../test-results/real-figma/2a4f36d0-7235-4c18-bc08-70773d081c23/report.html)。前者在真实 Figma 未握手时非零退出，零任务领取、零 Figma PNG，八项均标为未执行；没有重试或画布写入。后者在 geometry 通过后，于 flex-border 创建五个节点时按测试配置失败，非零退出，保留已通过和失败节点，其余六项标为未执行，没有清理任务。两轮都保留结构化错误与事件。额外的连接超时轮 `cfbf4553-91ca-4bc7-bc4b-3bf63632a74d` 同样零任务领取，未计入通过轮。

最终一轮结束后的 `npm run e2e:real:doctor` 显示 `lockExists: false`、`portAvailable: true`，Figma 进程仍运行；此前连接故障退出后也观察到锁与端口已释放。`npm run verify:all` 在本地与 PR CI 通过；受控协议测试属于可移植检查，不冒充实机结果。[运行指南](README.md)记录准备、首次绑定与导入、每轮插件启动、doctor/运行/报告命令和故障处理。

本验收覆盖真实 Figma 插件 API 的六个视觉场景与两条扩展下载到画布的集成路径；没有自动化真实 Figma 文件选择、粘贴或按钮控件，也不代表任意网站、字体或完整 CSS 支持。这里的后台模式仍要求 Figma 桌面引擎运行，以及用户在每轮 `PACKAGE_READY` 后启动已导入插件；不保证锁屏或完全无人值守。
