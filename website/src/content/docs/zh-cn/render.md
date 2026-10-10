---
title: render API
description: 将校验后的 Html2FigmaDocument 转换为可编辑 Figma 场景图层。
order: 3
---

## 方法签名

```ts
import { render } from 'html2figma/render';
import type { RenderOptions, RenderResult } from 'html2figma/render';
import { parseDocumentJson } from 'html2figma';

const json = '{ /* converted document */ }';
const options: RenderOptions = { parent: figma.currentPage, loadFonts: true };
const result: RenderResult = await render(parseDocumentJson(json), options);
```

用真实转换文档替换占位内容。在 Figma 插件运行时中调用，普通网页没有 Figma API。渲染外部 JSON 前先校验。

## 渲染选项

| 选项 | 类型 | 默认值 | 行为 |
| --- | --- | --- | --- |
| `parent` | `BaseNode & ChildrenMixin` | `figma.currentPage` | 生成根节点的父节点。 |
| `x` | `number` | 输入根节点的 `bounds.x` | 根节点在父节点中的横坐标。 |
| `y` | `number` | 输入根节点的 `bounds.y` | 根节点在父节点中的纵坐标。 |
| `loadFonts` | `boolean` | `true` | 创建可编辑文本前加载字体。 |

父节点需要支持追加场景图层。关闭字体加载时，应自行预加载所需字体。

## 返回结果

`RenderResult` 包含 `root: SceneNode`、`nodes: SceneNode[]` 和 `warnings: RenderWarning[]`。警告合并转换诊断与渲染回退信息，保留不同节点的诊断。

```ts
import { render } from 'html2figma/render';
import { parseDocumentJson } from 'html2figma';

const json = '{ /* converted document */ }';
const result = await render(parseDocumentJson(json));
figma.currentPage.selection = [result.root];
figma.viewport.scrollAndZoomIntoView([result.root]);
console.log(result.nodes.length, result.warnings);
```

## 字体与图片

Figma 需要能够访问所需字体及字重。缺失字体回退到 Inter，并产生 `font-load-failed`。网页中的 `@font-face` 不会在 Figma 中安装字体。

URL 图片通过插件网络权限读取。在自己的 manifest 中声明需要访问的域名；资源失败会产生渲染警告。data URL 可以减少对外部图片服务器的依赖。

## 可移植类型与原生类型

根入口导出平台无关的 `RenderOptions<Parent = unknown>` 和 `RenderResult<Node = unknown>`。需要 Figma 原生类型时，从 `html2figma/render` 导入同名类型。

## 错误处理

`render` 为异步方法，Figma 操作失败时可能拒绝 Promise。集成方应捕获错误。渲染器在失败后尝试移除已创建节点；清理也失败时抛出 `AggregateError`，部分节点可能保留。
