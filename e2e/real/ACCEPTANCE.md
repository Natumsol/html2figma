# 2026-09-23 macOS geometry 后台验收

[#2](https://github.com/Natumsol/html2figma/issues/2) 的单样例实机验收通过。
运行来源为已导入的独立「html2figma Real E2E」开发插件；插件 UI 隐藏，
由本地命令发出固定 geometry 指令，未使用 Figma MCP 或前台点击。

| 项目 | 本轮实测 |
| --- | --- |
| 运行 ID | `e29ef02d-e0e8-4086-b2cd-78966549284b` |
| 环境 | macOS 26.6.2；Figma 126.8.18；Chromium 147.0.7727.15；Node 22.14.0 |
| 文件与页面 | 验收文件 `3bfxbSZ7K2URZ3Aak50Wwd`，Page `0:1`，首次文件绑定已通过 |
| 本轮区域与节点 | 区域 `17:22`；[根节点 `17:23`](https://www.figma.com/design/3bfxbSZ7K2URZ3Aak50Wwd?node-id=17-23)；所有新增 ID `17:22`–`17:28` |
| 渲染 | 真实 Figma PNG，320×180，0 条警告 |
| 图像比较 | Playwright PNG 比较器通过；颜色阈值 0.2，最大差异像素比例 0.001 |
| 状态保持 | 前后均为 Page `0:1`、空选区；视口中心 `(2540.6961379665604, 608.6604178068715)`、缩放 `0.10843484848737717` 不变 |
| 事件 | 独立序号的 waiting → ready → claimed → area-created → result，各一条 |
| 资源 | 运行后 5173 端口与本轮锁已释放；新增图层保留 |

本轮文档、转换器、渲染器和插件 bundle 的 SHA-256 与冻结运行清单全部一致；
对应图像与完整报告保存在本机忽略目录
`test-results/real-figma/e29ef02d-e0e8-4086-b2cd-78966549284b/`。
Figma PNG 的 SHA-256 为
`3bc122224c8de463f8a4a58e16cf57770a56c41048fd18434e19afe091b517ca`。

先前两轮在用户启动正式插件前等待握手超时，未领取任务，也未渲染。
它们是连接超时的失败记录，不能算两轮成功；本记录只证明一轮真实 geometry 通过。
完整六场景、两条扩展集成与自动清理属于后续任务，未在此声称通过。

`npm run verify:all` 通过；最终协议检查 17 项和 E2E 类型检查通过。
GitHub Actions 的现有 Linux 检查通过，它们与上述真实 Figma 观察分开记录。
