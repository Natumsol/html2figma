---
title: Getting started
description: A small library that connects your browser DOM to an editable Figma canvas.
order: 1
---

## Install

```sh
npm install html2figma@1.0.2
```

This site, its Playground and the downloadable plugin use **html2figma 1.0.2**. The package is MIT licensed. You can integrate the browser converter, the Figma renderer, or both.

## Understand the two environments

`convert` runs in a real browser after the page has rendered. It reads computed CSS and measured geometry and returns a portable `Html2FigmaDocument`.

`render` runs inside a Figma plugin. It creates editable scene nodes from that document. JSON is the handoff between these environments.

The root `html2figma` entry exports portable types and JSON validators. Import browser code from `html2figma/convert` and Figma code from `html2figma/render`.

## Convert in the browser

```ts
import { convert } from 'html2figma/convert';

await document.fonts.ready;
const documentAst = convert(document.body);
const json = JSON.stringify(documentAst);
console.log(json, documentAst.warnings);
```

Wait for images, fonts and asynchronous page content before capturing. `convert` is synchronous; it does not fetch or wait for assets itself. It takes a DOM element or document, not an HTML string or webpage URL. It cannot run in a Node.js process without a real browser.

## Render in a Figma plugin

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

Replace the placeholder with valid converted JSON. Pass JSON from your plugin UI to the plugin runtime through your own transport. The library does not provide a hosted conversion service.

## Try before integrating

Open the [Playground](/playground/) to edit HTML/CSS and inspect JSON, or pick a preset in the [Gallery](/gallery/). Copy the JSON, [install the companion plugin](/docs/plugin/), paste into **Import JSON**, and choose **Render to Figma**.

> The browser preview shows your input. Check the resulting editable layers in Figma. HTML/CSS support is partial; a successful conversion does not guarantee pixel-perfect output.

Read the [support boundaries](/docs/support/) before integrating with production workflows.
