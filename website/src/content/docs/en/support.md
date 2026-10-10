---
title: Support & limitations
description: Know which browser features map to editable layers and where fallbacks apply.
order: 6
---

## What the library captures

The converter captures fixed measured geometry and supported computed styles from a rendered DOM. The renderer creates editable text, shapes, images and supported layouts. It does not recreate the browser engine or responsive behavior.

| Feature | Scope |
| --- | --- |
| Ordinary visible elements | Frames/rectangles and child text. |
| Text | Editable, but line wrapping and font metrics can differ. |
| Solid backgrounds, opacity, corner radius | Supported computed values. |
| Solid borders | Uniform strokes; asymmetric sides use helper rectangles with limitations. |
| Outer RGB/RGBA box shadows | Supported parsed shadows; inset or unparseable shadows are skipped. |
| Images | `currentSrc`, `cover` and `contain`; other fitting/positioning may differ. |
| Inline SVG | Serialized vectors; local `use` references expanded, complex SVG not guaranteed. |
| Canvas | Static PNG; drawing primitives are not editable. |
| Video | Static poster; without a poster, a frame and a warning. |
| Simple no-wrap flex | Fixed-size Auto Layout when supported properties match measured child positions. Otherwise absolute-position fallback. |
| Open Shadow DOM | Accessible roots traversed; closed roots unavailable. |

## Unsupported or partial behavior

CSS Grid and transforms do not have matching layout/transform rendering. Gradients, multiple background layers, filters, blend modes, pseudo-elements, animations, masks, table layout and responsive Figma constraints are not faithfully reproduced.

Iframe contents, native form control appearance and media playback are not captured faithfully. Simple HTML structure does not guarantee full semantic element support.

Flex wrap, reverse flow, reordered/positioned children, margins or layout mismatch can fall back to measured absolute positions.

## Read diagnostics

Common codes include `unsupported-css-grid`, `unsupported-transform`, `unsupported-background-image`, `unsupported-border-style`, `flex-layout-fallback`, `canvas-export-failed`, `video-poster-missing`, and `font-load-failed`.

Warnings describe known fallbacks. Some unsupported features do not emit warnings. A zero-warning result is not proof of identical output.

## Playground boundaries

Only HTML/CSS input is supported. User scripts, embedded browsing contexts and active event handlers are removed. Public image/font URLs are allowed, subject to loading and plugin access. No webpage URL import, local file upload, login, hosted conversion or saved cloud projects are included.

Presets have a fixed source layout; changing the preview width does not automatically make fixed-width CSS responsive. The preview scrolls when the input exceeds the chosen width.
