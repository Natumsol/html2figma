---
title: convert API
description: Capture computed styles and measured layout from a rendered browser DOM.
order: 2
---

## Signature

```ts
import { convert } from 'html2figma/convert';
import type { ConvertOptions, Html2FigmaDocument } from 'html2figma';

// convert(input: Element | Document, options?: ConvertOptions): Html2FigmaDocument
const result: Html2FigmaDocument = convert(document.body, { maxDepth: 20 });
```

Passing a `Document` uses its `documentElement`. Passing an `Element` captures that subtree. Run the converter inside the same browser realm as the input DOM; it uses browser globals and DOM constructors.

## Options

| Option | Type | Default | Behavior |
| --- | --- | --- | --- |
| `includeHidden` | `boolean` | `false` | Include nodes whose computed display is `none` or visibility is `hidden`; their measured geometry may be zero. |
| `maxDepth` | `number` | No depth limit | Stop traversing below the requested depth. Root depth is zero. |

Choose a finite, nonnegative depth for bounded captures. The converter reads a snapshot, not responsive layout rules.

## Returned document

`Html2FigmaDocument` includes `version: 1`, a `root` node, `resources`, aggregated `warnings`, and `metadata` containing source URL, viewport and creation time. Node warnings remain on individual nodes.

Image resources can reference public URLs or data URLs. SVG resources include serialized SVG data. Ordinary text remains editable after supported rendering; canvas pixels are a raster image.

## Failures and warnings

If the requested root is excluded, `convert` throws `Unable to convert root element`. Use a visible root or deliberately opt into hidden nodes.

Inspect `document.warnings` for unsupported CSS and fallbacks. Warning fields are `code`, `message`, `severity`, and optional `nodeId`, `cssProperty`, `source`. Not every unsupported CSS declaration produces a warning.

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

## Resource readiness

The Playground waits up to five seconds for image/stylesheet loading and then up to five seconds for fonts. Loading failures appear separately from library warnings. A CSS background image may still be unavailable; verify resources in Figma.

Your integration should choose its own readiness policy. URLs must be accessible to the Figma plugin later; browser login cookies and local-only addresses are not portable.
