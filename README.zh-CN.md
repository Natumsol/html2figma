# html2figma

![html2figma Logo](https://raw.githubusercontent.com/Natumsol/html2figma/master/docs/brand/logo.svg)

[English](https://github.com/Natumsol/html2figma/blob/master/README.md) · [简体中文](https://github.com/Natumsol/html2figma/blob/master/README.zh-CN.md)

将浏览器中的 DOM 树转换为可序列化的 Figma 节点数据，再通过 Figma 插件渲染为可编辑图层。浏览器转换、Figma 渲染和公共数据结构分别使用独立入口。

## 安装与使用

```sh
npm install html2figma
```

页面渲染完成后，在浏览器中读取计算后的 CSS 与实际元素尺寸：

```ts
import { convert } from "html2figma/convert";

const documentAst = convert(document.body);
```

将转换结果交给 Figma 插件：

```ts
import { render } from "html2figma/render";

const result = await render(documentAst, {
  parent: figma.currentPage,
  x: 0,
  y: 0,
  loadFonts: true
});

console.log(result.root, result.warnings);
```

`render` 返回根节点、创建的节点和警告。Figma 专用的 `RenderOptions` 与 `RenderResult` 从 `html2figma/render` 导入。包根入口提供平台无关的数据结构类型、`parseDocumentJson` 和 `isHtml2FigmaDocument`。

## 示例

- [Figma 插件示例](https://github.com/Natumsol/html2figma/tree/master/example/figma-plugin)：渲染内置 HTML 区块，或通过 Import JSON 导入。
- [Chrome 扩展示例](https://github.com/Natumsol/html2figma/tree/master/example/chrome-extension)：将当前网页或选区转换为 html2figma JSON。

```sh
npm ci
npm ci --prefix example
npm --prefix example run dev:figma
```

构建扩展可执行 `npm --prefix example run build`，然后通过 Chrome 的「Load unpacked」加载 `example/chrome-extension/dist`。

## 开发与验证

提交前运行 `npm run verify:all`。此命令检查浏览器/Figma 源码边界、库与示例的类型、单测、构建、浏览器测试和构建后的 UI E2E。CI 也使用此命令，但**不运行真实 Figma**。运行环境与调试命令见 [E2E 工程指南](https://github.com/Natumsol/html2figma/blob/master/e2e/README.md)。

渲染警告会保留节点诊断；JSON 导入校验检查数值范围、唯一 ID 和资源引用。图片加载失败会产生渲染警告。嵌入的 Base64 图片通过 Figma API 解码；HTTP 图片通过网络获取。

## 端到端测试

`npm run test:e2e` 在 Chromium 中测试构建后的扩展、JSON 导出/导入和插件 UI。插件 shell 使用 **Figma API 测试替身**，不检查真实 Figma 画布像素。

```sh
npm ci
npm ci --prefix example
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e:real` 在绑定的可编辑 Figma Design 文件中运行 **37 个场景**：**23 个元素 × CSS 还原度用例**、**12 个综合视觉用例**、**2 个扩展到真实画布用例**。每项检查预期警告、PNG 尺寸，以及浏览器和真实 Figma 图像的像素差异。23 个元素用例还检查目标标签、计算后的 CSS 和 AST 类型；文字/图片用例额外检查文字属性或图片填充。此命令需要 macOS、已登录的 Figma 与绑定的测试文件；正常运行不依赖 Agent。首次绑定与报告路径见[真实 Figma 指南](https://github.com/Natumsol/html2figma/blob/master/e2e/real/README.md)。

| 类别 | 真实 Figma 用例 | 验收点 |
| --- | --- | --- |
| `div`（3） | `div-radius-opacity`、`div-shadow`、`div-flex` | 填充、圆角、透明度、阴影、Flex 间距与内边距 |
| `article`（2） | `article-card`、`article-flex` | 嵌套文字、背景、圆角、内边距与 Flex |
| `span`（3） | `span-badge`、`span-inline`、`span-strike` | 行内文字、填充、下划线与删除线 |
| `p`（9） | `p-line-height`、`p-centered`、`p-bold`、`p-italic`、`p-wrap`、`p-right`、`p-lowercase`、`p-capitalize`、`p-font-fallback` | 行高、对齐、字距、字重、斜体、换行、大小写和字体回退 |
| `svg`（2） | `svg-fill`、`svg-stroke` | SVG 填充、描边与透明度 |
| `img`（2） | `img-cover`、`img-contain` | 图片填充、裁剪/适应、圆角与背景 |
| `canvas`（2） | `canvas-pixels`、`canvas-opacity` | 像素快照与透明度 |
| 综合视觉（12） | `geometry`、`flex-border`、`typography`、`flex-reverse`、`flex-absolute`、`media`、`edge-borders`、`text-transform`、`background-image`、`video-poster`、`flex-wrap`、`shadow-dom` | 跨特性几何、文字、图片、视频封面、Shadow DOM 与 Flex 降级警告 |
| 扩展 → 真实画布（2） | `extension-page`、`extension-selection` | 整页/选区 JSON 下载、渲染和画布像素对比 |

### 全部 37 组真实画布截图

下图是**同一轮 37/37 通过**的原始 PNG 导出（`f6eba5e2-d5c8-4668-aef1-61d00d749f07`，2026 年 9 月 24 日）。每行的两张图使用同一个 HTML 样例和相同的输出尺寸。百分比是该轮报告中的实测差异像素比例，**不是**允许上限。原始运行产物位于未跟踪的 `test-results/`，下图是纳入仓库的原样副本。

图片使用 `v0.1.0` 标签的绝对地址，以便在 npm 页面加载，并固定这轮测试的截图。

#### 综合视觉场景（12）

| 用例 · 实测差异像素 | Chromium 参考图 | 真实 Figma 导出图 |
| --- | --- | --- |
| `geometry` · 0.000% | ![浏览器参考图：geometry](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/geometry-browser.png) | ![真实 Figma 导出图：geometry](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/geometry-figma.png) |
| `flex-border` · 0.000% | ![浏览器参考图：flex-border](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/flex-border-browser.png) | ![真实 Figma 导出图：flex-border](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/flex-border-figma.png) |
| `typography` · 1.055% | ![浏览器参考图：typography](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/typography-browser.png) | ![真实 Figma 导出图：typography](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/typography-figma.png) |
| `flex-reverse` · 0.000% | ![浏览器参考图：flex-reverse](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/flex-reverse-browser.png) | ![真实 Figma 导出图：flex-reverse](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/flex-reverse-figma.png) |
| `flex-absolute` · 0.000% | ![浏览器参考图：flex-absolute](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/flex-absolute-browser.png) | ![真实 Figma 导出图：flex-absolute](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/flex-absolute-figma.png) |
| `media` · 0.000% | ![浏览器参考图：media](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/media-browser.png) | ![真实 Figma 导出图：media](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/media-figma.png) |
| `edge-borders` · 0.000% | ![浏览器参考图：edge-borders](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/edge-borders-browser.png) | ![真实 Figma 导出图：edge-borders](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/edge-borders-figma.png) |
| `text-transform` · 0.025% | ![浏览器参考图：text-transform](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/text-transform-browser.png) | ![真实 Figma 导出图：text-transform](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/text-transform-figma.png) |
| `background-image` · 0.031% | ![浏览器参考图：background-image](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/background-image-browser.png) | ![真实 Figma 导出图：background-image](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/background-image-figma.png) |
| `video-poster` · 0.000% | ![浏览器参考图：video-poster](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/video-poster-browser.png) | ![真实 Figma 导出图：video-poster](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/video-poster-figma.png) |
| `flex-wrap` · 0.000% | ![浏览器参考图：flex-wrap](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/flex-wrap-browser.png) | ![真实 Figma 导出图：flex-wrap](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/flex-wrap-figma.png) |
| `shadow-dom` · 0.000% | ![浏览器参考图：shadow-dom](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/shadow-dom-browser.png) | ![真实 Figma 导出图：shadow-dom](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/shadow-dom-figma.png) |

#### HTML 元素 × CSS 场景（23）

| 用例 · 实测差异像素 | Chromium 参考图 | 真实 Figma 导出图 |
| --- | --- | --- |
| `div-radius-opacity` · 0.000% | ![浏览器参考图：div-radius-opacity](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/div-radius-opacity-browser.png) | ![真实 Figma 导出图：div-radius-opacity](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/div-radius-opacity-figma.png) |
| `div-shadow` · 0.000% | ![浏览器参考图：div-shadow](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/div-shadow-browser.png) | ![真实 Figma 导出图：div-shadow](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/div-shadow-figma.png) |
| `div-flex` · 0.000% | ![浏览器参考图：div-flex](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/div-flex-browser.png) | ![真实 Figma 导出图：div-flex](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/div-flex-figma.png) |
| `article-card` · 0.025% | ![浏览器参考图：article-card](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/article-card-browser.png) | ![真实 Figma 导出图：article-card](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/article-card-figma.png) |
| `article-flex` · 0.000% | ![浏览器参考图：article-flex](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/article-flex-browser.png) | ![真实 Figma 导出图：article-flex](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/article-flex-figma.png) |
| `span-badge` · 0.064% | ![浏览器参考图：span-badge](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/span-badge-browser.png) | ![真实 Figma 导出图：span-badge](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/span-badge-figma.png) |
| `span-inline` · 0.619% | ![浏览器参考图：span-inline](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/span-inline-browser.png) | ![真实 Figma 导出图：span-inline](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/span-inline-figma.png) |
| `p-line-height` · 0.037% | ![浏览器参考图：p-line-height](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-line-height-browser.png) | ![真实 Figma 导出图：p-line-height](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-line-height-figma.png) |
| `p-centered` · 0.201% | ![浏览器参考图：p-centered](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-centered-browser.png) | ![真实 Figma 导出图：p-centered](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-centered-figma.png) |
| `p-bold` · 0.020% | ![浏览器参考图：p-bold](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-bold-browser.png) | ![真实 Figma 导出图：p-bold](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-bold-figma.png) |
| `p-italic` · 0.641% | ![浏览器参考图：p-italic](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-italic-browser.png) | ![真实 Figma 导出图：p-italic](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-italic-figma.png) |
| `p-wrap` · 0.133% | ![浏览器参考图：p-wrap](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-wrap-browser.png) | ![真实 Figma 导出图：p-wrap](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-wrap-figma.png) |
| `p-right` · 0.043% | ![浏览器参考图：p-right](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-right-browser.png) | ![真实 Figma 导出图：p-right](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-right-figma.png) |
| `span-strike` · 0.105% | ![浏览器参考图：span-strike](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/span-strike-browser.png) | ![真实 Figma 导出图：span-strike](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/span-strike-figma.png) |
| `p-lowercase` · 0.055% | ![浏览器参考图：p-lowercase](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-lowercase-browser.png) | ![真实 Figma 导出图：p-lowercase](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-lowercase-figma.png) |
| `p-capitalize` · 0.039% | ![浏览器参考图：p-capitalize](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-capitalize-browser.png) | ![真实 Figma 导出图：p-capitalize](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-capitalize-figma.png) |
| `p-font-fallback` · 0.016% | ![浏览器参考图：p-font-fallback](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-font-fallback-browser.png) | ![真实 Figma 导出图：p-font-fallback](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/p-font-fallback-figma.png) |
| `svg-fill` · 0.000% | ![浏览器参考图：svg-fill](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/svg-fill-browser.png) | ![真实 Figma 导出图：svg-fill](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/svg-fill-figma.png) |
| `svg-stroke` · 0.000% | ![浏览器参考图：svg-stroke](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/svg-stroke-browser.png) | ![真实 Figma 导出图：svg-stroke](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/svg-stroke-figma.png) |
| `img-cover` · 0.000% | ![浏览器参考图：img-cover](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/img-cover-browser.png) | ![真实 Figma 导出图：img-cover](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/img-cover-figma.png) |
| `img-contain` · 0.000% | ![浏览器参考图：img-contain](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/img-contain-browser.png) | ![真实 Figma 导出图：img-contain](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/img-contain-figma.png) |
| `canvas-pixels` · 0.000% | ![浏览器参考图：canvas-pixels](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/canvas-pixels-browser.png) | ![真实 Figma 导出图：canvas-pixels](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/canvas-pixels-figma.png) |
| `canvas-opacity` · 0.000% | ![浏览器参考图：canvas-opacity](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/canvas-opacity-browser.png) | ![真实 Figma 导出图：canvas-opacity](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/canvas-opacity-figma.png) |

#### 扩展到真实画布（2）

| 用例 · 实测差异像素 | Chromium 参考图 | 真实 Figma 导出图 |
| --- | --- | --- |
| `extension-page` · 0.710% | ![浏览器参考图：extension-page](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/extension-page-browser.png) | ![真实 Figma 导出图：extension-page](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/extension-page-figma.png) |
| `extension-selection` · 0.655% | ![浏览器参考图：extension-selection](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/extension-selection-browser.png) | ![真实 Figma 导出图：extension-selection](https://raw.githubusercontent.com/Natumsol/html2figma/v0.1.0/docs/images/e2e/extension-selection-figma.png) |

大多数非文字用例最多允许 **0.1%** 差异像素；普通文字用例整图最多 **2%**，文字区域最多 **12%**。`span-strike` 更严格：整图 **0.2%**、文字区域 **2%**。单像素颜色阈值为 **0.2**，用于容忍栅格化差异。这些阈值不等于完全一致，也不代表所有 HTML/CSS 组合已经覆盖。用例定义见[元素清单](https://github.com/Natumsol/html2figma/blob/master/e2e/visual/fidelity-cases.json)和[综合清单](https://github.com/Natumsol/html2figma/blob/master/e2e/visual/cases.json)；已知缺口见[覆盖矩阵](https://github.com/Natumsol/html2figma/blob/master/e2e/COVERAGE.md)。

日常运行 `npm run test:e2e:real`；单项定位使用 `npm run test:e2e:real -- --case img-contain`。旧的 Agent 辅助视觉流程仍可通过 `npm run e2e:visual:prepare` 和 `npm run test:e2e:visual` 执行，参见[E2E 指南](https://github.com/Natumsol/html2figma/blob/master/e2e/README.md#真实-figma-画布截图验收)。

## HTML 与 CSS 支持范围

下表描述当前实现。「部分支持」表示可以抓取，但存在列出的 Figma 表现限制。普通元素使用通用 DOM 路径，不表示所有语义标签都已完整支持。

| HTML 元素 | 状态 | 当前行为与限制 |
| --- | --- | --- |
| `div`、`span`、`p`、`article` 等普通可见元素 | 支持常见结构/样式 | 转换为 Frame 或 Rectangle，保留嵌套元素和可编辑文字；浏览器默认样式可能存在差异。 |
| 文本节点 | 部分支持 | 测量边界并映射为可编辑文字；空白字符会折叠，复杂行内排版和字体度量可能有差异。 |
| `img`，包括 `picture` 内的 `img` | 部分支持 | 使用 `currentSrc`；映射 `object-fit: cover` 和 `contain`。其他适配方式和 `object-position` 无法准确还原；`source` 不生成 Figma 节点。 |
| 内联 `svg` | 部分支持 | 序列化为 SVG，并展开本地 `<use href="#…">`；不保证外部引用和全部 SVG 特性。 |
| `canvas` | 部分支持 | 导入静态 PNG；导出失败产生 `canvas-export-failed`，图形元素不可单独编辑。 |
| `video` | 部分支持 | `poster` 变为静态图片；无封面时生成 Frame 并产生 `video-poster-missing`。不支持播放。 |
| 开放的 Shadow DOM | 部分支持 | 遍历可访问的 `shadowRoot`；closed root 无法访问。 |
| `iframe`、原生表单控件、媒体播放 | **不支持内容级还原** | 外层元素可能走通用路径，但不转换 iframe 内部、原生控件外观/状态或媒体播放。 |

| CSS 特性 | 状态 | 当前行为与限制 |
| --- | --- | --- |
| 测量尺寸/位置、纯色 `background-color`、`opacity`、各角 `border-radius` | 支持 | 根据计算样式和浏览器边界生成固定尺寸快照；不生成响应式 Figma 约束。 |
| 纯色边框 | 部分支持 | 四边一致时使用 Stroke；不同边使用矩形辅助层。复杂转角拼接，以及图片/SVG/canvas/video 节点上的辅助层无法准确还原；非 `solid` 样式产生 `unsupported-border-style`。 |
| `background-image` | 部分支持 | 支持单层 `url(...)`；`background-size: contain` 映射为 fit，其余尺寸映射为 fill。渐变或多层背景产生 `unsupported-background-image`；重复和平移无法准确还原。 |
| `box-shadow` | 部分支持 | 解析符合格式的外阴影，包括多个 `rgb()`/`rgba()` 阴影；内阴影或无法解析的阴影被跳过。 |
| 文字颜色、字体家族/字号/字重/字形、像素行高/字距、对齐、下划线/删除线、大小写 | 部分支持 | 映射为可编辑文字。Figma 字体缺失时回退 Inter 并产生 `font-load-failed`；复杂文字排版无法完全一致。 |
| 简单的 `display: flex` / `inline-flex` | 部分支持 | 行/列、不换行布局仅在可重现实测子元素位置时转为固定尺寸 Auto Layout。反向、换行、重排/定位子元素、外边距或坐标不符时保留绝对位置，并产生 `flex-layout-fallback`。 |
| CSS Grid、`transform` | **不支持** | 无对应 Figma 布局或变换；产生 `unsupported-css-grid` 或 `unsupported-transform`。AST 仍可能保留测量后的边界。 |
| Filter、混合模式、伪元素、动画、裁剪、Mask、表格布局、原生表单样式、响应式 Figma 约束 | **不支持** | 没有对应的保真实现；不是所有不支持的声明都会产生警告。 |

## 发布

`npm run release:dry-run` 预览 npm 与 GitHub 发布，不执行发布。`npm run release` 先验证库，再通过 `release-it` 更新版本、发布到 npm、提交、打标签、推送并创建 GitHub Release。请先登录 npm，并在环境变量中提供 `GITHUB_TOKEN`；不要将凭据写入仓库。`publishConfig` 固定使用官方 npm Registry。

该包已发布到 npm 和 GitHub。下次运行 `npm run release` 时，应交互选择新版本。
