# E2E 还原度覆盖矩阵

`npm run test:e2e` 检查构建后的扩展与插件 UI，Figma API 使用测试替身。
`npm run test:e2e:real` 在已绑定的 Figma Design 文件中导出真实画布 PNG，
与同一 HTML 元素的 Chromium 截图逐像素比较。后者才是视觉还原度验收；
`npm run verify:all` 不启动真实 Figma。

| HTML 元素 | CSS 与内容组合 | 真实画布场景 |
| --- | --- | --- |
| `div` | 背景色、圆角、透明度；实体阴影；Flex、间距与内边距 | `div-radius-opacity`、`div-shadow`、`div-flex` |
| `article` | 圆角卡片、内边距、嵌套段落；Flex 布局 | `article-card`、`article-flex` |
| `span` | 行内块、背景、圆角、文字；行内颜色、下划线与删除线 | `span-badge`、`span-inline`、`span-strike` |
| `p` | 字号、行高、居中、字间距、粗体、斜体、多行换行、右对齐、大小写变换与字体回退 | `p-line-height`、`p-centered`、`p-bold`、`p-italic`、`p-wrap`、`p-right`、`p-lowercase`、`p-capitalize`、`p-font-fallback` |
| `svg` | 内嵌填充图形；描边与透明度 | `svg-fill`、`svg-stroke` |
| `img` | `object-fit: cover`、圆角；`object-fit: contain`、背景色 | `img-cover`、`img-contain` |
| `canvas` | 像素内容；像素内容与透明度 | `canvas-pixels`、`canvas-opacity` |

这二十三项由 [`fidelity-cases.json`](visual/fidelity-cases.json) 和
[`fidelity.html`](fixtures/fidelity.html) 共同定义。准备阶段检查目标标签、
实际计算后的 CSS、转换后的 AST 类型与预期警告；文字场景还核对 AST 文本属性。
Figma 结果检查 PNG 尺寸、资源填充、警告和像素差异。每项保留浏览器 PNG、Figma PNG、差异像素数与比例；
失败时额外保留差异图和本轮 Figma 节点。文字项要求整图差异像素比例不超过 2%，
同时对 AST 文本节点所在区域单独计算，最多允许 12%；
接近文本颜色的像素数还须保留至少 45%，避免缺失文字被空白面积稀释。
`span-strike` 在行高留白修正后采用更严格的整图 0.2%、文字区域 2% 上限，
用于防止删除线随文字再次下移。
其余元素项整图最多 0.1%。
单像素颜色阈值为 0.2。局部阈值容忍字体抗锯齿与浏览器/Figma 字形栅格化差异，
不能视为字符轮廓逐像素相同。

此外，[`cases.json`](visual/cases.json) 和 [`visual.html`](fixtures/visual.html)
定义十二项综合场景，覆盖几何、边框、Flex 反向/绝对定位/换行、文字变换、
PNG、背景图、视频封面和开放的 Shadow DOM。另有 `extension-page` 与
`extension-selection` 两项验证真实扩展下载结果最终在 Figma 中的效果。
默认一次执行三十七项，可用 `npm run test:e2e:real -- --case CASE_NAME`
单独定位其中一项。

现阶段尚未覆盖所有 HTML 元素或 CSS 属性组合。尤其是复杂响应式页面、
多种字体回退、远程图片失败和不支持 CSS 的降级效果，不能由这二十三项外推为已验证。
多条不同颜色边框在同一元素角落相交时，浏览器采用斜接，当前转换结果由矩形边框层叠加；
`edge-borders` 只验证互不相交的单边边框。真实 Figma 图片导出曾间歇性出现全白 PNG，
因此每次运行仍须以本轮真实 PNG 和报告为准。
