# 真实 Figma 后台验收：六个视觉场景与两条扩展集成

[2026-09-23 实机验收记录](ACCEPTANCE.md)保存了已通过的一轮结果与证据边界。
[2026-09-23 六场景实机验收记录](SIX_CASES_ACCEPTANCE.md)保存了本入口的六项结果。
[2026-09-23 扩展下载到真实画布验收记录](EXTENSION_ACCEPTANCE.md)保存了八项同轮结果。

本入口在 [#2](https://github.com/Natumsol/html2figma/issues/2) 单样例切片上实现 [#3](https://github.com/Natumsol/html2figma/issues/3) 与 [#4](https://github.com/Natumsol/html2figma/issues/4)：
同一轮对 geometry、flex-border、typography、flex-reverse、flex-absolute、media
依次执行当前浏览器 convert → 共享 JSON 校验 → 真实 Figma render → PNG → 视觉比较。
随后在无头 Chromium 中运行真实构建后的扩展，分别完成整页抓取与选区抓取，
下载两份 JSON，再经隐藏插件的共享 JSON 校验路径渲染并比较。
Figma 阶段不激活桌面窗口、不模拟点击/键盘、不使用剪贴板，不修改选区或视口。
八个场景各自保存输入、浏览器图、Figma 图和必要时的差异图；保留所有新增图层。
成功后的自动清理由后续任务实现。

## 准备与运行

需要 macOS、已登录且运行中的 Figma、Node 22.12+、根目录及 example 的 npm 依赖、
Playwright Chromium，以及可编辑的专用 Figma Design 文件。先运行：

```sh
npm run e2e:real:doctor
```

诊断是只读检查：报告版本、Chromium、运行锁、5173 端口及本地目标配置。
未观察到必要环境、未配置目标、端口冲突或锁占用时退出码为 2；运行期间的真实握手
才会验证 Figma 文件、持久标记和插件构建，doctor 不把进程存在当作连接成功。

第一次运行显式指定专用文件 key 和 page ID：

```sh
npm run test:e2e:real -- --bind --file-key YOUR_FILE_KEY --page-id 0:1 --timeout-ms 300000
```

命令构建库和两个示例，启动自己的 loopback 服务，生成浏览器参考图，并打印
`PACKAGE_READY`、本轮输出目录和 manifest 绝对路径。此时在 Figma 中首次导入
`test-results/real-figma/plugin/manifest.json`，运行「html2figma Real E2E」。
已有原型插件是另外一个插件；不能把原型注册视为正式 E2E 插件已注册。

启动插件后 UI 隐藏，命令自动串行执行本轮八个样例，保存报告并退出；你可以切回其他工作。
目标文件/page 必须保持可用；观察到 page、选区或视口变化会使运行失败并保留现场，
不会自动恢复用户状态。插件成功回传或报告失败并收到确认后关闭自身。

后续使用同一入口：

```sh
npm run test:e2e:real
```

每轮重新构建，看到 `PACKAGE_READY` 后运行指定插件，以便加载当前构建。
不依赖开发插件自动重载，也不自动启动插件。默认等待 120 秒；`--timeout-ms`
支持 1000–600000 毫秒。超时不重试渲染，已领取但未确认的任务记为 `unknown`。
普通运行不会补写缺失的文件标记；首次绑定中断时可对同一目标显式再次传入 `--bind`。

## 结果与隔离

每轮产物保存在忽略目录 `test-results/real-figma/<runId>/`：

- 八份当前输入、两份真实扩展下载 JSON、冻结的扩展和 converter/renderer/schema、
  实际插件 bundle 和构建身份。
- 独立编号的事件、结果、浏览器 PNG、Figma PNG、必要时的差异图。
- `report.json` 和 `report.html`：状态、节点链接、尺寸、警告、身份及环境版本。

```sh
npm run e2e:real:report -- /absolute/path/to/run-directory
```

此命令输出已存在的 HTML 报告路径，不自动打开浏览器或激活窗口。
成功退出 0；环境、构建、连接、执行、图像或产物保存失败退出非零。缺失结果不会跳过。
采用 `e2e/visual/cases.json` 标准：颜色阈值 0.2，typography 最大差异像素比例
0.02，其余五项 0.001；flex-reverse 与 flex-absolute 各需一条
`flex-layout-fallback` 警告，其余零警告。任何场景失败便停止派发后续场景，
报告列出未执行项；晚到结果不能把失败改成通过。
两条扩展集成各要求 320×180、零警告、颜色阈值 0.2 和最大差异像素比例 0.02。
普通插件构建不包含 Bridge，现有 UI 测试继续覆盖文件/粘贴控件；本报告不冒充
真实 Figma 文件选择、粘贴或按钮控件的验收。

每个用户的临时目录中有全局运行锁，跨工作区阻止同时运行；端口被占用时直接失败。
不自动移除遗留锁：先检查锁目录的 owner.json 和对应 PID，确认无运行任务后人工移除。
退出只释放本轮锁和服务、关闭本轮测试浏览器，不终止 Figma 或其他端口所有者。

本地 `target.json` 保存文件/page/绑定标记。插件 bundle 含当轮随机通信凭据，整个
`test-results/` 都是本地产物，不要提交或公开 bundle。日志与报告不记录通信凭据。
绑定只写入专用文件的插件私有元数据，新图层只在具备本轮所有权的区域创建。

## 开发验证

```sh
npm run e2e:typecheck
npm run test:e2e:real:unit
npm run verify:all
```

协议检查通过公开 HTTP 通道使用受控对端，测试过期身份、重复领取、PNG 结果及
超时后的拒绝行为；它们不是实机证据。普通 Linux 检查不会启动真实 Figma。
运行 verify:all 前结束实机运行，因为两者都需要 5173 端口。
