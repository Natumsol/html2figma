# 真实 Figma 画布验收记录

日期：2026-09-23。团队：SK。

[验收文件](https://www.figma.com/design/3bfxbSZ7K2URZ3Aak50Wwd) 中的节点由本仓库
`dist/render.cjs` 创建，输入来自 Chromium 中运行的 `convert()`。
截图为节点通过 Figma `exportAsync()` 导出的 1× sRGB PNG。

| 用例 | 画布节点 | 结果 | 最大差异像素比例 |
| --- | --- | --- | --- |
| 几何、透明度、圆角、SVG | [geometry](https://www.figma.com/design/3bfxbSZ7K2URZ3Aak50Wwd?node-id=6-2) | 通过 | 0.1% |
| Flex、非对称边框 | [flex-border](https://www.figma.com/design/3bfxbSZ7K2URZ3Aak50Wwd?node-id=6-8) | 通过 | 0.1% |
| 文本行高与位置 | [typography](https://www.figma.com/design/3bfxbSZ7K2URZ3Aak50Wwd?node-id=6-13) | 通过 | 2% |

每像素颜色阈值为 0.2。三个用例均要求节点尺寸一致且无渲染警告。
阈值在修复前后保持不变。字体固定为 `@fontsource/inter@4.5.15`，
与验收环境中的 Inter Regular 使用相同的 `wght/slnt` 字轴。

## 本次验收发现并修复的问题

- Figma 要求图层挂到 Auto Layout 父节点后才能设置 `layoutPositioning = ABSOLUTE`。
  渲染器已调整顺序，并在挂载后恢复边框辅助图层的位置；单元测试与 E2E 替身补上了约束。
- CSS 边框占据内容空间。转换出的 Flex 内边距现在包含边框宽度，避免内容沿边框方向偏移。
  覆盖透明边框和不支持绘制的边框占位。
- 对只有一个文本节点且显式指定行高的块元素，Range 字形边界不等于行框。
  转换器现在使用内容区起点与行高计算纵向边界，避免在 Figma 中重复加入行间留白。

新增的两个浏览器回归用例在修复前失败、修复后通过；强化后的边框渲染单元测试也验证了失败到通过。

## 验证

- `npm run verify`：类型检查、36 个单元测试、构建通过。
- `npm run test:browser`：27 个用例通过。
- `npm run e2e:typecheck`：通过。
- `npx playwright test -c e2e/playwright.config.ts`：11 个用例通过。
- `npm run test:e2e:visual`：3 个真实画布用例通过。

原始 AST、浏览器截图、Figma 返回数据位于 `test-results/figma-visual/`。
HTML 报告位于 `playwright-report/figma-visual/`。生成产物不提交到 Git。
这是上述三个固定用例的验收结果，不代表全部 CSS 或字体都能无损转换。
复跑方法见 [E2E 工程说明](../README.md)。
