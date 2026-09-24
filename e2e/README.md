# E2E 测试工程

这里测试构建后的 Chrome 扩展与 Figma 插件。复用根目录的 Playwright 依赖，
配置、用例、静态服务、测试替身和真实画布验收脚本放在独立的 `e2e/` 目录。

## 安装与运行

需要 Node.js 22.12+，并为测试保留 `localhost:5173`。
该端口与示例插件的 `example.config.ts` 一致；测试不会复用已有开发服务。

```sh
npm ci
npm ci --prefix example
npx playwright install chromium
npm run e2e:typecheck
npm run test:e2e
```

`test:e2e` 先构建库和两个示例，再启动测试服务。日常调试可使用：

```sh
npm run test:e2e:ui
npm run test:e2e -- --headed
npm run test:e2e -- --grep 'captures selection'
npm run e2e:report
```

已经构建且只修改测试时，可运行 `npx playwright test -c e2e/playwright.config.ts`。
失败时保存截图、trace 和 HTML 报告；产物在 `test-results/e2e/` 与
`playwright-report/e2e/`，不进入 Git。每个扩展测试使用独立的临时 Chromium profile。

## 覆盖范围

- 扩展初始空状态、整页抓取、鼠标选择元素与高亮恢复。
- 真实 content script → service worker → JSON viewer 的消息链路。
- JSON 文件下载、插件文件导入与粘贴导入、文档摘要和资源保留。
- 六个内置 HTML 示例经过 Shadow DOM 转换和插件 shell 转发后渲染。
- 实际图片字节加载、SVG、字体加载、文本、边框辅助图层、选中和缩放。
- 无效 JSON 拒绝和单个预览加载失败后的隔离。

测试打开扩展 popup 的实际 HTML 页面，以不切换焦点的按钮事件触发抓取，
使真实 `chrome.tabs.query` 仍指向待抓取页面。Chrome API 和转换代码均未替换。
下载用例检查文件内容；操作系统的另存为对话框不属于自动化范围。

插件 UI 在真实嵌套 iframe 内运行。构建后的插件主入口运行于 Node VM，
通过 Figma API 测试替身记录节点、字体、图片、通知和画布操作。
这部分检查消息与渲染行为；真实 Figma 的属性约束和像素效果由下面的独立流程验收。

## 本机后台 API 验收

新增 [真实 Figma 后台验收入口](real/README.md)，使用独立的「html2figma Real E2E」
隐藏 UI 插件，后台调用本仓库真实 renderer，无需 Figma MCP；默认自动打开绑定文件，
并在准备完成后通过 AppleScript 点击插件菜单。首次导入开发插件时使用 `--manual-plugin`。
同一轮覆盖十二个综合视觉场景、二十三个按 HTML 元素与 CSS 属性组织的还原度场景，
以及两条扩展下载链路；全部通过后保存证据并清理本轮节点，
失败时保留现场。插件仍需在每轮准备完成后启动。现有 UI 控件测试与历史
六场景流程保持独立。
各能力在浏览器、构建后 UI 和真实画布中的覆盖情况见 [覆盖矩阵](COVERAGE.md)。

```sh
npm run e2e:real:doctor
npm run test:e2e:real
npm run test:e2e:real -- --case canvas-pixels
npm run test:e2e:real -- --manual-plugin --bind --file-key YOUR_FILE_KEY --page-id 0:1
```

## 真实 Figma 画布截图验收

已有 [2026-09-23 验收记录](visual/ACCEPTANCE.md)，包含真实 Figma 节点链接与本次发现的回归问题。

这一步需要可编辑的 Figma Design 文件和已登录的 Figma MCP 连接。
它执行本仓库构建出的 `dist/render.cjs`，不使用其他 HTML 转 Figma 工具。

1. 运行 `npm run e2e:visual:prepare`。脚本启动并关闭本地服务，生成
   `test-results/figma-visual/` 下由 `e2e/visual/cases.json` 定义的十二组浏览器参考截图、转换 AST 和 `*.render.js`。
2. 在验收文件中，通过 `use_figma` 逐个执行生成的 `*.render.js`。
   自动化代理应先读取 `figma-use` 技能，并先只读检查文件。
   每个脚本执行真实 `render()`、创建节点并以 1× PNG 导出 Figma 画布。
   将返回对象保存为同目录的 `<用例名>.result.json`，保留 `pngBase64`。
3. 运行 `npm run test:e2e:visual`，生成画布截图附件和失败时的像素差异图。
   HTML 报告位于 `playwright-report/figma-visual/`。

用例覆盖几何形状、透明度、圆角、SVG、Flex 布局、非对称边框、文本、PNG 图片，以及反向 Flex 和绝对定位子元素的降级效果。
该手动流程只读取综合场景清单；元素 × CSS 场景请使用 `npm run test:e2e:real` 自动验收。
对比要求尺寸一致，警告必须与用例清单完全一致（降级用例恰好一条，其余零条）；几何用例允许至多 0.1% 像素差异，
文本用例允许至多 2%，每像素颜色阈值为 0.2，用于容忍字体抗锯齿差异。
浏览器从固定的 `@fontsource/inter@4.5.15` 加载 Inter，Figma 使用 Inter Regular。
该字体版本使用 `wght/slnt` 字轴，与此次 Figma 环境一致；较新的字体包使用不同的字形与字轴，
不能仅凭家族名称相同就替换截图基准字体。
字体回退会产生警告并使验收失败。

返回结果包含 AST、converter 与 renderer 的 SHA-256，防止把旧构建的截图当作本次结果。
缺少真实 Figma 结果会失败，不会跳过，也不会自动创建或更新参考截图。
修改渲染代码后应重新执行准备、Figma 渲染和对比三个步骤。
每次渲染在已有节点右侧追加测试图层，返回所有新增节点 ID，便于定位或清理。

## CI

`.github/workflows/e2e.yml` 通过 `npm run verify:all` 在 Linux Chromium 上运行核心库和两个示例的类型检查、单元测试、
源码运行环境隔离与独立消费者声明检查、浏览器转换测试和完整 UI 链路，并上传测试报告。
真实 Figma 验收单独运行，因为它依赖已认证的可编辑文件；CI 不会伪造这一步的成功。
