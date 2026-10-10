---
title: JSON 与公共类型
description: 了解文档结构、校验方法与公共类型入口。
order: 4
---

## 校验输入 JSON

```ts
import { parseDocumentJson, isHtml2FigmaDocument } from 'html2figma';

const json = '{ /* converted document */ }';
const documentAst = parseDocumentJson(json);
const unknownValue: unknown = documentAst;
if (isHtml2FigmaDocument(unknownValue)) console.log(unknownValue.root);
```

`parseDocumentJson(value: string): Html2FigmaDocument` 解析并校验 JSON 字符串。语法无效时抛出 `JSON could not be parsed.`，结构无效时抛出 `JSON is not a valid html2figma document.`。用真实 JSON 替换占位内容。

`isHtml2FigmaDocument(value: unknown): value is Html2FigmaDocument` 校验已解析值，对于普通的无效 JSON 数据返回 false。

校验覆盖字段类型、有限数值、数值范围、节点与资源 ID 唯一性，以及资源引用类型。它不会加载图片、检查已安装字体或证明视觉还原度。应用应自行限制输入大小。

## 文档结构

| 字段 | 含义 |
| --- | --- |
| `version` | AST 格式版本，目前为字面量 `1`，与库版本 `1.0.2` 不同。 |
| `root` | 根 `Html2FigmaNode`。 |
| `resources` | 图片或 SVG 资源。 |
| `warnings` | 汇总的转换诊断。 |
| `metadata` | 可选来源 URL、视口尺寸和创建时间。 |

## 节点类型

`Html2FigmaNode` 为 `frame`、`rectangle`、`text`、`image`、`svg` 的可辨识联合类型。每个节点包含 ID、名称、测量尺寸、样式、来源、警告和子节点。文本节点增加 `text`，图片与 SVG 增加 `resourceId`，图片还可携带 `alt`。

`AstBounds` 包含 `x`、`y`、`width`、`height`。`AstStyle` 包含可选的透明度、填充、描边、圆角、阴影、排版和支持的 Flex 布局信息。这些字段描述受支持的输出，不是完整 CSS 模型。

## 根入口类型

| 类型 | 用途 |
| --- | --- |
| `Html2FigmaDocument`、`Html2FigmaNode` | 文档与节点联合类型。 |
| `AstBounds`、`AstStyle` | 几何信息与样式。 |
| `ConvertOptions` | 浏览器遍历选项。 |
| `ConvertWarning`、`RenderWarning` | 诊断信息，渲染警告沿用转换警告结构。 |
| `ResourceRef` | ID、图片/SVG 类型、来源，以及可选数据与 MIME 类型。 |
| `RenderOptions<Parent>`、`RenderResult<Node>` | 可移植渲染泛型。 |

安装包中的 TypeScript 声明提供完整嵌套字段与字面量联合类型，可通过 IDE 查看。使用公共入口，不要直接导入私有 dist 文件。

## 资源可移植性

只有引用资源也可访问时，JSON 才能完整传递。Playground 图片可使用公开 URL 和 data URL，Gallery 案例已内嵌图片。字体文件和浏览器登录态不会写入 JSON。
