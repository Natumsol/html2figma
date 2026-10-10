---
title: render API
description: Create editable Figma scene nodes from a validated Html2FigmaDocument.
order: 3
---

## Signature

```ts
import { render } from 'html2figma/render';
import type { RenderOptions, RenderResult } from 'html2figma/render';
import { parseDocumentJson } from 'html2figma';

const json = '{ /* converted document */ }';
const options: RenderOptions = { parent: figma.currentPage, loadFonts: true };
const result: RenderResult = await render(parseDocumentJson(json), options);
```

Replace the placeholder with a valid converted document. Run in the Figma plugin runtime; browser pages do not provide the Figma API. Validate external JSON before rendering.

## Options

| Option | Type | Default | Behavior |
| --- | --- | --- | --- |
| `parent` | `BaseNode & ChildrenMixin` | `figma.currentPage` | Parent for the generated root. |
| `x` | `number` | Input root's `bounds.x` | Root placement on the parent. |
| `y` | `number` | Input root's `bounds.y` | Root placement on the parent. |
| `loadFonts` | `boolean` | `true` | Load fonts before creating editable text. |

Use a parent that supports appending scene nodes. Disabling font loading requires you to preload all required fonts.

## Result

`RenderResult` contains `root: SceneNode`, `nodes: SceneNode[]`, and `warnings: RenderWarning[]`. Warnings merge conversion diagnostics with render-time fallbacks, preserving distinct node diagnostics.

```ts
import { render } from 'html2figma/render';
import { parseDocumentJson } from 'html2figma';

const json = '{ /* converted document */ }';
const result = await render(parseDocumentJson(json));
figma.currentPage.selection = [result.root];
figma.viewport.scrollAndZoomIntoView([result.root]);
console.log(result.nodes.length, result.warnings);
```

## Fonts and images

Figma must have the requested font family/style available. Missing fonts fall back to Inter and emit `font-load-failed`. A web `@font-face` declaration does not install the font in Figma.

URL image retrieval uses the plugin's network access. Declare required domains in your plugin manifest; resource failures produce render warnings. Data URLs avoid reliance on an external image server.

## Portable and native types

The root entry exports platform-neutral `RenderOptions<Parent = unknown>` and `RenderResult<Node = unknown>`. For native Figma types, import the same names from `html2figma/render`.

## Error handling

`render` is asynchronous and can reject if Figma operations fail. Catch failures in your integration. The renderer attempts to remove created nodes after a failure; if cleanup also fails, it throws an `AggregateError` and some nodes may remain.
