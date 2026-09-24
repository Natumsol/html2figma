# 真实 Figma 后台验收：六个视觉场景与两条扩展集成

[2026-09-23 实机验收记录](ACCEPTANCE.md)保存了已通过的一轮结果与证据边界。
[2026-09-23 六场景实机验收记录](SIX_CASES_ACCEPTANCE.md)保存了本入口的六项结果。
[2026-09-23 扩展下载到真实画布验收记录](EXTENSION_ACCEPTANCE.md)保存了八项同轮结果。
[2026-09-23 安全清理与失败留痕验收记录](SAFE_CLEANUP_ACCEPTANCE.md)保存了正常清理和受控失败结果。
[2026-09-24 两轮八项最终验收记录](TWO_RUN_ACCEPTANCE.md)保存了独立双轮与故障证据。

本入口在 [#2](https://github.com/Natumsol/html2figma/issues/2) 单样例切片上实现 [#3](https://github.com/Natumsol/html2figma/issues/3) 与 [#4](https://github.com/Natumsol/html2figma/issues/4)：
同一轮对 geometry、flex-border、typography、flex-reverse、flex-absolute、media
依次执行当前浏览器 convert → 共享 JSON 校验 → 真实 Figma render → PNG → 视觉比较。
随后在无头 Chromium 中运行真实构建后的扩展，分别完成整页抓取与选区抓取，
下载两份 JSON，再经隐藏插件的共享 JSON 校验路径渲染并比较。
默认运行时，启动插件前自动打开绑定文件、激活 Figma，并通过 AppleScript 点击
开发插件菜单；场景执行阶段不操作桌面 UI，也不修改选区或视口。使用
`--manual-plugin` 时由用户在 `PACKAGE_READY` 后启动插件。
八个场景各自保存输入、浏览器图、Figma 图和必要时的差异图。全部渲染通过后，
运行器先保存 `report.before-cleanup.json/html`，再发送一次有限清理任务。插件核对
本轮区域、全部通过节点及 SVG 内部节点的所有权和清单后，删除本轮区域；最终保存
清理回执与 `report.json/html`。故障时不发送清理任务，保留失败、未知和此前通过的节点。

## 准备与运行

需要 macOS、已登录的 Figma、Node 22.12+、根目录及 example 的 npm 依赖、
Playwright Chromium，以及可编辑的专用 Figma Design 文件。先运行：

```sh
npm ci
npm ci --prefix example
npx playwright install chromium
```

首次在专用 Figma 文件中准备好 Inter 字体与开发插件导入权限。日常检查先运行：

```sh
npm run e2e:real:doctor
```

诊断是只读检查：报告版本、Chromium、运行锁、5173 端口及本地目标配置。
未观察到必要环境、未配置目标、端口冲突或锁占用时退出码为 2；运行期间的真实握手
才会验证 Figma 文件、持久标记和插件构建。默认运行会自行启动 Figma，
因此 doctor 不要求启动前存在 Figma 进程。

第一次运行显式指定专用文件 key 和 page ID：

```sh
npm run test:e2e:real -- --manual-plugin --bind --file-key YOUR_FILE_KEY --page-id 0:1 --timeout-ms 300000
```

首次使用 `--manual-plugin`，因为开发插件尚未导入，自动启动无法找到插件。命令构建库和
两个示例，启动自己的 loopback 服务，生成浏览器参考图，并打印
`PACKAGE_READY`、本轮输出目录和 manifest 绝对路径。此时在 Figma 中首次导入
`test-results/real-figma/plugin/manifest.json`，运行「html2figma Real E2E」。
已有原型插件是另外一个插件；不能把原型注册视为正式 E2E 插件已注册。

启动插件后 UI 隐藏，命令自动串行执行本轮八个样例，保存初版报告、清理通过节点、
保存最终报告并退出；你可以切回其他工作。
目标文件/page 必须保持可用；观察到 page、选区或视口变化会使运行失败并保留现场，
不会自动恢复用户状态。插件成功回传或报告失败并收到确认后关闭自身。

后续使用同一入口：

```sh
npm run test:e2e:real
```

每轮重新构建，自动打开绑定文件，并在 `PACKAGE_READY` 后通过 AppleScript
启动已导入的指定插件，以便加载当前构建。Figma 未运行时也会启动桌面应用。
如需手动启动，在命令中加入 `--manual-plugin`，并在 `PACKAGE_READY` 后运行插件。
`--launch-plugin` 仍可显式指定自动模式。
本机需要允许运行命令的终端控制 Figma 与「系统事件」，并预先从**当前仓库**的
`test-results/real-figma/plugin/manifest.json` 导入插件。打开文件可能改变启动前
的视口；测试只要求插件握手后选区与视口保持不变。启动失败会使本轮非零退出；
即使点击成功，仍需等待插件握手核对文件、页面、绑定和构建身份。
自动启动不依赖开发插件自动重载。
默认等待 120 秒；`--timeout-ms`
支持 1000–600000 毫秒。超时不重试渲染，已领取但未确认的任务记为 `unknown`。
普通运行不会补写缺失的文件标记；首次绑定中断时可对同一目标显式再次传入 `--bind`。

## 两轮独立回归

在同一目标 Mac 上依次运行两次 `npm run test:e2e:real -- --timeout-ms 600000`。
每轮在 `PACKAGE_READY` 后自动启动已导入的插件；第一轮结束并释放
运行锁和端口后，再开始第二轮。不要把同一轮的重复握手或旧报告算成第二轮。两轮成功时
应各有新的 runId、八份本轮 Figma PNG、`report.before-cleanup.json/html`、
`cleanup.result.json` 和最终 `report.json/html`，且 `attempted` 恰好八项、
`unexecuted` 为空、`cleanup.status` 为 `passed`。逐项核对尺寸、精确警告、
视觉标准、构建/输入身份及 page/selection/viewport 快照；清理回执的
`topLevelAfter` 应只比 `topLevelBefore` 少本轮区域 ID。

每轮结束后再运行 `npm run e2e:real:doctor`，确认 `lockExists: false` 和
`portAvailable: true`；它只证明自有运行锁与 5173 端口已释放，不代替实机验收。

## 结果与隔离

每轮产物保存在忽略目录 `test-results/real-figma/<runId>/`：

- 八份当前输入、两份真实扩展下载 JSON、冻结的扩展和 converter/renderer/schema、
  实际插件 bundle 和构建身份。
- 独立编号的事件、结果、浏览器 PNG、Figma PNG、必要时的差异图。
- `report.before-cleanup.json/html`：清理前完整结果与节点链接；`report.json/html`：
  最终状态、清理结果、尺寸、警告、身份及环境版本。成功时还有 `cleanup.result.json`，
  失败时保留 `*.failure.json` 或 `cleanup.failure.json`。

```sh
npm run e2e:real:report -- /absolute/path/to/run-directory
```

此命令输出已存在的 HTML 报告路径，不自动打开浏览器或激活窗口。
成功退出 0；环境、构建、连接、执行、图像或产物保存失败退出非零。缺失结果不会跳过。
采用 `e2e/visual/cases.json` 标准：颜色阈值 0.2，typography 最大差异像素比例
0.02，其余五项 0.001；flex-reverse 与 flex-absolute 各需一条
`flex-layout-fallback` 警告，其余零警告。任何场景失败便停止派发后续场景，
报告列出未执行项；晚到结果不能把失败改成通过。
如需验证失败现场，可用 `--inject-failure-case flex-border` 运行一次专用 E2E 构建：
插件在该用例实际创建节点后报告受控失败，命令应非零退出，保留本轮所有节点。
这个参数只用于故障验收，报告会标明注入目标；日常运行不要传入。
两条扩展集成各要求 320×180、零警告、颜色阈值 0.2 和最大差异像素比例 0.02。
普通插件构建不包含 Bridge，现有 UI 测试继续覆盖文件/粘贴控件；本报告不冒充
真实 Figma 文件选择、粘贴或按钮控件的验收。

连接未成功时，报告会记录非零退出、失败原因和未执行项；先确认 Figma 已打开目标文件
和页面，且插件在本轮 `PACKAGE_READY` 后启动。超时的包已失效，不能在旧插件中
继续执行；排查后用新命令生成新 runId。已领取任务超时会标记 `unknown`，不得在
同一轮重投。用例、证据保存或清理失败时查看该轮 `event-*.json`、结构化错误和保留
的节点现场；不要删除旧区域、自动重试渲染或放宽阈值。若连接失败发生在握手前，
`attempted` 应为空，画布没有本轮任务写入。

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
