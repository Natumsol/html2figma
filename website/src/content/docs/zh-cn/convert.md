---
title: convert API
description: 从浏览器渲染后的 DOM 读取计算样式与布局尺寸。
order: 2
---

## 方法签名

```ts
import { convert } from 'html2figma/convert';
import type { ConvertOptions, Html2FigmaDocument } from 'html2figma';

// convert(input: Element | Document, options?: ConvertOptions): Html2FigmaDocument
const result: Html2FigmaDocument = convert(document.body, { maxDepth: 20 });
```

传入 Document 时转换其 `documentElement`，传入 Element 时转换对应子树。转换方法与输入 DOM 应处于同一浏览器环境，它使用浏览器全局对象和 DOM 构造器。

## 转换选项

| 选项 | 类型 | 默认值 | 行为 |
| --- | --- | --- | --- |
| `includeHidden` | `boolean` | `false` | 包含计算样式为 `display: none` 或 `visibility: hidden` 的节点，测量尺寸可能为零。 |
| `maxDepth` | `number` | 不限制深度 | 超过指定深度后停止遍历，根节点深度为零。 |

需要限制捕获范围时，使用有限的非负深度。转换结果是固定尺寸快照，不包含响应式布局规则。

## 返回文档

`Html2FigmaDocument` 包含 `version: 1`、`root`、`resources`、汇总 `warnings`，以及记录来源 URL、视口和创建时间的 `metadata`。节点保留各自的警告。

图片资源可以引用公开 URL 或 data URL。SVG 资源包含序列化后的 SVG。普通文本在受支持的渲染流程中保留可编辑性，canvas 像素作为栅格图片处理。

## 错误与警告

根节点被排除时，`convert` 抛出 `Unable to convert root element`。选择可见根节点，或明确启用隐藏节点选项。

检查 `document.warnings` 中的未支持样式与回退信息。警告包含 `code`、`message`、`severity`，以及可选的 `nodeId`、`cssProperty`、`source`。并非所有未支持的 CSS 都会产生警告。

```ts
import { convert } from 'html2figma/convert';

try {
  const result = convert(document.querySelector('main') || document.body);
  for (const warning of result.warnings) {
    console.log(warning.code, warning.nodeId, warning.message);
  }
} catch (error) {
  console.error(error);
}
```

## 资源加载时机

Playground 等待图片和样式表加载，超时为五秒；随后等待字体，超时也为五秒。加载失败会单独展示，不混入库警告。CSS 背景图片仍可能无法加载，请在 Figma 中验证。

自己的集成应定义合适的资源就绪策略。Figma 插件需要在之后访问资源 URL，浏览器登录 Cookie 和仅本地可用的地址不能随 JSON 传递。
