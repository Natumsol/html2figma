---
title: JSON & public types
description: The portable handoff, its validator and the public type surface.
order: 4
---

## Validate incoming JSON

```ts
import { parseDocumentJson, isHtml2FigmaDocument } from 'html2figma';

const json = '{ /* converted document */ }';
const documentAst = parseDocumentJson(json);
const unknownValue: unknown = documentAst;
if (isHtml2FigmaDocument(unknownValue)) console.log(unknownValue.root);
```

`parseDocumentJson(value: string): Html2FigmaDocument` parses and validates a JSON string. Invalid syntax throws `JSON could not be parsed.` Invalid schema throws `JSON is not a valid html2figma document.` Replace the placeholder with real converted JSON.

`isHtml2FigmaDocument(value: unknown): value is Html2FigmaDocument` validates an already parsed value without throwing for ordinary invalid JSON-shaped data.

The validator checks typed fields, finite numbers, numeric ranges, unique node/resource IDs, and typed resource references. It does not load images, inspect installed fonts, or prove visual fidelity. Bound input size in your own application.

## Document structure

| Field | Meaning |
| --- | --- |
| `version` | AST schema version, currently literal `1`; distinct from library version `1.0.2`. |
| `root` | Root `Html2FigmaNode`. |
| `resources` | Image or SVG resource records. |
| `warnings` | Aggregate conversion diagnostics. |
| `metadata` | Optional source URL, viewport dimensions, creation timestamp. |

## Node types

`Html2FigmaNode` is a discriminated union of `frame`, `rectangle`, `text`, `image`, and `svg`. All nodes carry an ID, name, measured bounds, style, source, warnings and children. Text nodes add `text`; image/SVG nodes add `resourceId`; images can have `alt`.

`AstBounds` provides `x`, `y`, `width`, `height`. `AstStyle` includes optional opacity, fills, strokes, per-corner radius, shadows, typography and supported flex layout metadata. Fields describe supported measured output rather than a complete CSS model.

## Root exports

| Export | Purpose |
| --- | --- |
| `Html2FigmaDocument`, `Html2FigmaNode` | Document and node union. |
| `AstBounds`, `AstStyle` | Geometry and styles. |
| `ConvertOptions` | Browser traversal options. |
| `ConvertWarning`, `RenderWarning` | Diagnostics; render warnings share the conversion warning shape. |
| `ResourceRef` | ID, image/SVG type, source, optional data and MIME type. |
| `RenderOptions<Parent>`, `RenderResult<Node>` | Portable generic renderer types. |

The installed package's TypeScript declarations provide complete nested field definitions and literal unions. Your IDE can inspect them directly. Do not import private `dist` files; use the public entrypoints.

## Resource portability

A JSON document is portable only when its referenced assets are accessible. Playground images can use public URLs and data URLs; Gallery presets embed their image assets. Font files and browser authentication are not bundled into JSON.
