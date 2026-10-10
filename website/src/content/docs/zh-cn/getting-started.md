---
title: 快速开始
description: 用一个小巧的库，连接浏览器 DOM 与可编辑 Figma 画布。
order: 1
---

## 安装

```sh
npm install html2figma@1.0.2
```

本站文档、Playground 和下载插件统一使用 **html2figma 1.0.2**，采用 MIT 许可证。你可以接入浏览器转换、Figma 渲染，或完整流程。

## 理解两个运行环境

`convert` 在真实浏览器中读取渲染后的 DOM、计算样式与布局尺寸，返回可传递的 `Html2FigmaDocument`。

`render` 在 Figma 插件运行时中把文档转换为可编辑场景图层。JSON 是两个环境之间的传递格式。

根入口 `html2figma` 提供可移植类型与 JSON 校验方法。浏览器代码从 `html2figma/convert` 导入，Figma 代码从 `html2figma/render` 导入。

## 在浏览器中转换

```ts
import { convert } from 'html2figma/convert';

await document.fonts.ready;
const documentAst = convert(document.body);
const json = JSON.stringify(documentAst);
console.log(json, documentAst.warnings);
```

转换前等待图片、字体和异步页面内容完成加载。`convert` 是同步方法，不会自动等待资源。它接收 DOM 元素或 Document，不能直接接收 HTML 字符串或网页 URL，也不能在没有真实浏览器的 Node.js 进程中运行。

## 在 Figma 插件中渲染

```ts
import { parseDocumentJson } from 'html2figma';
import { render } from 'html2figma/render';

const json = '{ /* JSON received from your browser */ }';
const documentAst = parseDocumentJson(json);
const result = await render(documentAst, {
  parent: figma.currentPage,
  x: 0,
  y: 0,
  loadFonts: true
});
figma.currentPage.selection = [result.root];
console.log(result.warnings);
```

将占位内容替换为真实 JSON。通过你自己的传递方式，把插件 UI 中的 JSON 交给插件运行时。库本身不提供在线转换服务。

## 先体验，再集成

在 [Playground](/zh-cn/playground/) 编辑 HTML/CSS，或选择[案例集](/zh-cn/gallery/)中的案例。复制 JSON，[安装配套插件](/zh-cn/docs/plugin/)，在「Import JSON」中粘贴并点击「Render to Figma」。

> 网页预览展示输入内容。请在 Figma 中检查最终图层。HTML/CSS 支持范围有限，成功转换不代表输出逐像素一致。

集成前请阅读[支持范围与限制](/zh-cn/docs/support/)。
