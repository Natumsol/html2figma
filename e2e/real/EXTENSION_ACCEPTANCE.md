# 扩展下载到真实 Figma 画布验收（2026-09-23）

[#4](https://github.com/Natumsol/html2figma/issues/4) 在同一轮后台插件会话中完成六个浏览器视觉场景，以及真实构建后扩展的整页抓取和选区抓取。运行 ID 为 `77d6042b-102a-45d4-9b76-1daa7dc2ce79`；[本地报告](../../test-results/real-figma/77d6042b-102a-45d4-9b76-1daa7dc2ce79/report.html)保存输入 JSON、浏览器与 Figma PNG、逐项结果和事件日志。`test-results/` 按仓库约定不提交，因此报告链接只在本工作区有效。

| 扩展场景 | 下载 JSON SHA-256 | Figma 根节点 | 尺寸 | 警告 | 视觉结果 |
| --- | --- | --- | --- | --- | --- |
| 整页抓取 `extension-page` | `bbdbbd11b5dafb9e1bde68395e73c299ed21743322e946bf1b11d64c86d4be3b` | `23:172` | 320×180 | 无 | 通过 |
| 选区抓取 `extension-selection` | `0370b3a15cef64a41b5775eaf2fd674c753a95f2619efabbbe6a0553f4bd79e5` | `23:178` | 320×180 | 无 | 通过 |

两份 JSON 由冻结的扩展构建通过实际 popup、content script、service worker 和 viewer 下载流程取得；扩展构建 SHA-256 为 `9cdaafcf8eaecb927f2c3e83eb2f7705b02b2c1f122fe169e567c74b2e76430c`。下载文件的原始字节 SHA-256 与报告中的输入身份一致，隐藏插件通过共享 JSON 校验路径后回传的 `documentJson` 与下载文件逐字节相同。两项均在颜色阈值 0.2、最大差异像素比例 0.02 的标准内通过；浏览器和 Figma 图像均已人工检查，选区图像不含卡片外文本。

本轮八项均通过，没有缺失或未执行场景。六个基础场景的尺寸、警告和视觉阈值也满足各自标准。27 个有序事件覆盖握手、八次领取、保存和放行。转换器、渲染器、插件 bundle 的 SHA-256 分别为 `893eaceeee90e6c39f4bdde7a30349764593e7cfb3d0ee395dbab99ca74cfdba`、`ad8dba50d31b59526a8806a3c4f1c6f828fa05ac8af58417a95050882db71a61`、`f1301c1e32fb4db45f954f937b3f8cd2ddbe1fa97d156dc4e4eced63efa5e66f`。

绑定的专用文件为 `3bfxbSZ7K2URZ3Aak50Wwd`，页面为 `0:1`，本轮区域节点为 `23:147`。八项逐项快照显示页面、选区、视口中心和缩放在渲染前后相同；旧节点与本轮新增节点均保留。环境为 macOS 26.6.2、Figma 126.8.18、Node 22.14.0、Chromium 147.0.7727.15。本验收覆盖真实扩展下载、共享 JSON 校验、Figma 插件 API 渲染及 PNG 比对；不包含 Figma 桌面文件选择、粘贴或按钮控件操作。
