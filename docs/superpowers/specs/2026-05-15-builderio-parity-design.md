# BuilderIO Parity Design

## Context

The project already separates browser conversion from Figma rendering through a shared AST. The current implementation covers solid fills, simple borders, radii, text styles, opacity, box shadows, image elements, SVG elements, and simple flex layout. BuilderIO's `@builder.io/html-to-figma` package includes several additional pragmatic conversion behaviors that improve real-world page import reliability.

## Goals

- Add high-value compatibility features inspired by BuilderIO's converter without replacing the existing architecture.
- Keep `convert` browser-only and `render` Figma-only.
- Prefer existing AST shapes where possible.
- Preserve graceful degradation through warnings instead of hard failures.
- Add focused unit and browser coverage for each new behavior.

## Conversion Scope

The first implementation pass will add these conversion capabilities:

- Parse single `background-image: url(...)` values into existing image fills. `background-size: contain` maps to `fit`; other supported values default to `fill`.
- Warn and skip gradients or multiple background layers.
- Skip standalone visual conversion for `<picture>` and `<source>`, while continuing to use `img.currentSrc`.
- Convert `<video poster="...">` into an image node. Video without poster remains a non-image visual node and emits a warning.
- Traverse open shadow roots after normal child nodes. Source paths will mark the boundary with `::shadow`.
- Clone SVG resources before storing them and expand local `<use href="#...">` references when possible. Missing symbols produce warnings and preserve the original SVG.
- Map CSS `text-transform` to AST text case metadata.
- Represent differing solid per-side borders as thin rectangle child nodes named `#border-top`, `#border-right`, `#border-bottom`, and `#border-left`.

## AST And Rendering

Only one public schema addition is planned: `AstTextStyle.textCase?: "upper" | "lower" | "title"`.

Existing schema forms will be reused:

- Background images use `ImageFill`.
- Video posters use `ImageAstNode` with `source.tagName` set to `video`.
- SVG `<use>` expansion remains inside the existing SVG resource data.
- Shadow DOM appears in `source.path`, not as a new node type.
- Single-side borders are ordinary rectangle nodes, so render needs no special branch for them.

Rendering changes are intentionally small:

- Map `textCase` to Figma `TextNode.textCase`.
- Continue resolving image fills through the existing adapter path and warning fallback.
- Render generated border rectangles like any other rectangle.

## Error Handling

Unsupported or partial cases must produce warnings and continue conversion:

- `unsupported-background-image` for gradients and multiple layers.
- `video-poster-missing` for videos without poster images.
- `svg-use-unresolved` for local `<use>` references that cannot be expanded.
- `unsupported-border-style` for non-solid border sides that otherwise look visible.

Image loading failures continue to be render warnings, not conversion failures.

## Out Of Scope

- CSS grid fidelity.
- CSS transforms, filters, blend modes, masks, and clip paths.
- Precise multi-background rendering.
- Figma constraints and responsive resizing metadata.
- BuilderIO-style frame regrouping.
- Native form control appearance.

## Testing

Browser tests will cover DOM-dependent behavior:

- Background image URL resource creation.
- Unsupported background image warnings.
- Picture/source handling with `currentSrc`.
- Video poster image conversion and missing-poster warnings.
- Shadow DOM traversal and `::shadow` source paths.
- SVG `<use>` expansion.
- Text transform extraction.
- Per-side border rectangle generation.

Unit tests will cover pure helpers and rendering:

- Background image parsing.
- Per-side border comparison and generated bounds.
- Text case mapping.
- Render mapping from AST `textCase` to Figma text case.

Before handoff, run `npm run verify` and `npm run test:browser`.
