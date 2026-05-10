# html2figma TypeScript Library Design

## Status

Approved design direction from brainstorming. This spec defines the first implementation scope for a TypeScript library that converts browser HTML DOM into serializable Figma node data, then renders that data inside a Figma plugin.

## Goals

- Provide a TypeScript library with two primary functions:
  - `convert`: runs in a browser-like environment and converts real DOM into a serializable AST.
  - `render`: runs in the Figma plugin main context and creates Figma nodes from the AST.
- Correctly handle common HTML elements and core CSS properties.
- Map supported HTML/CSS semantics to Figma node properties with predictable degradation.
- Keep browser and Figma runtime dependencies separated.
- Make unsupported or lossy mappings observable through warnings.

## Non-Goals

- Parse arbitrary HTML strings in the first version.
- Fully implement every CSS feature.
- Provide plugin UI, page messaging, viewport zooming, selection, or notifications.
- Provide screenshot-based rendering fallback.
- Depend on a network proxy service.

## Package Shape

The library is published as one npm package with multiple public entrypoints:

```ts
import { convert } from "html2figma/convert";
import { render } from "html2figma/render";
import type { Html2FigmaDocument } from "html2figma";
```

The package has these internal areas:

- `convert`: browser-only conversion entrypoint.
- `render`: Figma plugin-only rendering entrypoint.
- `schema`: shared serializable AST types, resource types, warning types, and public options.
- `utils`: small testable helpers for colors, CSS lengths, fonts, shadows, borders, resources, and box model data.

The browser entrypoint must not reference Figma plugin globals. The render entrypoint must not require DOM APIs.

## Public API

### `convert`

```ts
function convert(
  input: Element | Document,
  options?: ConvertOptions
): Html2FigmaDocument;
```

`convert` reads real browser DOM, computed CSS, layout boxes, text content, image sources, and SVG markup. It returns pure JSON data that can be serialized and passed to a Figma plugin main context.

```ts
type ConvertOptions = {
  strict?: boolean;
  includeHidden?: boolean;
  preserveTextNodes?: boolean;
  maxDepth?: number;
};
```

Default behavior is permissive. Unsupported CSS or uncertain mappings generate warnings instead of throwing. With `strict: true`, severe conversion errors fail conversion.

### `render`

```ts
async function render(
  document: Html2FigmaDocument,
  options?: RenderOptions
): Promise<RenderResult>;
```

```ts
type RenderOptions = {
  parent?: BaseNode & ChildrenMixin;
  x?: number;
  y?: number;
  loadFonts?: boolean;
};

type RenderResult = {
  root: SceneNode;
  nodes: SceneNode[];
  warnings: RenderWarning[];
};
```

`render` creates Figma nodes, applies supported properties, loads fonts when requested, imports image resources, and returns the created root node plus all created nodes.

## AST Design

The conversion result is a custom versioned document, not direct Figma API JSON:

```ts
type Html2FigmaDocument = {
  version: 1;
  root: Html2FigmaNode;
  resources: ResourceRef[];
  warnings: ConvertWarning[];
  metadata: {
    sourceUrl?: string;
    viewport: { width: number; height: number };
    createdAt: string;
  };
};
```

First-version node types:

```ts
type Html2FigmaNode =
  | FrameAstNode
  | TextAstNode
  | RectangleAstNode
  | ImageAstNode
  | SvgAstNode;
```

Every node includes:

- `id`: stable ID generated during conversion.
- `name`: readable name derived from tag, role, text, class, or source.
- `type`: AST node type.
- `bounds`: final browser layout box.
- `style`: normalized visual and layout properties.
- `children`: child AST nodes when applicable.
- `source`: source tag and optional selector-like path.
- `warnings`: node-local conversion warnings.

## Element Mapping

- Container elements such as `div`, `section`, `main`, `header`, `footer`, `article`, `nav`, `ul`, and `li` become `FrameAstNode`.
- Text content becomes `TextAstNode`, preserving content and supported typography.
- Simple elements with visual box styling and no children may become `RectangleAstNode`.
- Elements with both visual styling and children become `FrameAstNode` with fills, strokes, effects, and children.
- `img` elements become `ImageAstNode`.
- Supported `background-image: url(...)` values become image fills or image resources.
- Inline `svg` elements become `SvgAstNode`; render should prefer `figma.createNodeFromSvg`.

## Layout Strategy

`convert` uses `getBoundingClientRect()` as the source of truth for dimensions and positions. This gives first-version visual fidelity even when layout semantics cannot be fully preserved.

The converter also attempts to recognize simple flex containers and records Figma-compatible layout metadata:

- direction
- gap
- padding
- main-axis alignment
- cross-axis alignment
- simple wrapping state

When flex recognition is reliable, `render` should create Auto Layout frames. When recognition fails, `render` should use absolute positioning inside frames.

## Supported CSS Scope

The first version supports core visual and layout properties:

- Box model: width, height, min/max dimensions, padding, margin, border, and box sizing.
- Positioning and stacking: final layout position, position-derived offsets, and z-index ordering.
- Backgrounds: solid background colors and a single basic `url(...)` background image.
- Borders and radii: border color, width, solid style, and per-corner radius.
- Text: font family, font size, font weight, font style, line height, letter spacing, text align, text decoration, and color.
- Flex: display flex, direction, gap, padding, main-axis alignment, cross-axis alignment, and simple wrap.
- Effects: opacity and common box-shadow forms.
- Images: `img` source, object-fit, and object-position basics.

Unsupported or partially supported features produce warnings:

- CSS grid
- transform, rotate, and scale
- filter and backdrop-filter
- blend mode
- pseudo elements
- animation and transition
- complex gradients
- complex clipping and masks
- table layout
- native form control appearance

## Warnings

Warnings make lossy conversion and rendering visible:

```ts
type ConvertWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  nodeId?: string;
  cssProperty?: string;
  source?: string;
};
```

Render warnings use the same shape where possible. Examples include unsupported CSS properties, failed font loading, failed image loading, SVG import failure, and fallback from Auto Layout to absolute positioning.

## Render Behavior

`render` is responsible for:

- Creating `FrameNode`, `TextNode`, `RectangleNode`, image fills, and SVG nodes.
- Applying size, position, fills, strokes, corner radius, effects, opacity, and constraints.
- Creating Auto Layout when AST layout metadata is reliable.
- Loading fonts before setting text.
- Falling back to available fonts when loading fails and recording a warning.
- Converting image resources into Figma image hashes.
- Creating placeholder frames when image resources fail.
- Preserving AST hierarchy in the Figma layer tree.

`render` is not responsible for:

- Selecting created nodes.
- Scrolling or zooming the viewport.
- Calling `figma.notify`.
- Implementing plugin UI.
- Moving data between a browser page, iframe, and plugin main context.

## Resource Handling

Resources are represented separately from nodes so the AST remains serializable and deduplicated.

```ts
type ResourceRef = {
  id: string;
  type: "image" | "svg";
  source: string;
  data?: string;
  mimeType?: string;
};
```

First version should support direct image URLs and data URLs. Cross-origin image fetching constraints are surfaced as warnings rather than hidden failures.

## Testing Strategy

Testing should be layered:

- Unit tests for color parsing, CSS length normalization, font mapping, shadow parsing, border parsing, and warning generation.
- Fixture tests for HTML/CSS input to AST output and expected warnings.
- Browser-backed conversion tests for behavior that depends on `getComputedStyle()` and `getBoundingClientRect()`.
- Render tests through a Figma API adapter or mock, so core rendering behavior can be tested outside the real Figma runtime.
- Visual regression can be added later, but it is not a first-version release blocker.

## Success Criteria

- A user can call `convert(document.body)` in a browser context and receive a serializable document.
- A Figma plugin can pass that document to `render(document)` and create an editable Figma layer tree.
- Common page sections with text, boxes, backgrounds, borders, shadows, images, and simple flex layout are represented correctly.
- Unsupported CSS does not silently disappear; it is recorded in warnings.
- Browser-only and Figma-only code remain separated by package entrypoint.
