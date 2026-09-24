# Architecture

## Overview

`html2figma` is split into two runtime entrypoints:

- `html2figma/convert`: runs in a browser context and converts live DOM into a serializable AST.
- `html2figma/render`: runs in a Figma plugin main context and turns the AST into Figma scene nodes.

The shared contract between those runtimes is defined in `src/schema/types.ts`. Browser code must not depend on Figma globals, and render code must not depend on DOM APIs.

## Package Entrypoints

- `src/index.ts`: exports shared public types.
- `src/convert.ts`: exports `convert(input, options)`.
- `src/render.ts`: exports `render(document, options)`.

`package.json` exposes these as root, `./convert`, and `./render` subpath exports. The package builds ESM, CJS, and declaration files through `tsup`.

## Conversion Pipeline

The conversion side lives under `src/convert/`.

1. `convert()` accepts an `Element` or `Document`.
2. `convertElement()` walks the DOM tree and creates AST nodes.
3. `readBounds()` reads browser layout using `getBoundingClientRect()`.
4. `readStyle()` normalizes computed CSS into `AstStyle`.
5. Resources such as images and SVG markup are collected into `ResourceRef[]`.
6. Unsupported or lossy mappings are recorded as structured warnings.

The converter prioritizes reliable visual geometry from the browser. It also preserves simple flex metadata so render can create editable Figma Auto Layout where possible.
Flex content insets include CSS border widths. Standalone block text with an
explicit line-height uses line-box vertical bounds to avoid adding leading twice.

Resource-like CSS features are resolved during conversion. Single URL background images become image fill resources, video posters become image nodes, and SVG resources are cloned before local `<use>` expansion. Unsupported resource forms emit warnings and continue.

## Shared AST

`Html2FigmaDocument` is the top-level serialized payload:

- `version`: schema version.
- `root`: root `Html2FigmaNode`.
- `resources`: deduplicated external data references.
- `warnings`: document-level conversion warnings.
- `metadata`: source URL, viewport, and creation timestamp.

Supported node types are `frame`, `text`, `rectangle`, `image`, and `svg`. Every node carries bounds, style, source metadata, child nodes, and node-local warnings.

## Rendering Pipeline

The render side lives under `src/render/`.

1. `render()` creates a real Figma adapter from the plugin `figma` API.
2. `renderWithAdapter()` recursively walks the AST.
3. `createAdapterNode()` maps AST node types to Figma-like nodes.
4. `applyBaseProperties()` and `applyStyle()` apply geometry and visual properties.
5. Text rendering loads fonts, falls back to `Inter Regular`, and applies text-specific properties.
6. Image fills are resolved through `createImageAsync()`.
7. SVG resources are created through `createNodeFromSvg()` when data is available.

If rendering throws after node creation, the adapter attempts to remove every
node created by that render call. Cleanup failures are reported with the
original rendering error.

The adapter abstraction keeps render behavior unit-testable without a live Figma runtime.

Generated helper rectangles, including asymmetric border layers, render through the normal rectangle path. Text case metadata maps directly to Figma text case.
Auto Layout child positioning is assigned after parenting. Absolute border
helpers then restore their relative coordinates because insertion can move them.

## Utilities

Pure helpers live in `src/utils/`:

- `color.ts`: parses CSS `rgb()` and `rgba()` values.
- `length.ts`: parses pixel lengths.
- `shadow.ts`: parses supported `box-shadow` values.
- `font.ts`: normalizes font family and weight values.
- `warnings.ts`: creates structured warnings.

These utilities are intentionally narrow and covered by unit tests.

## Testing Strategy

- `tests/unit/`: Vitest tests for schema, utilities, warning creation, and render adapter behavior.
- `tests/browser/`: Playwright tests for browser-only conversion behavior that depends on computed CSS and layout.
- `tests/fixtures/`: HTML fixtures used by Playwright tests.
- `e2e/`: built extension and plugin UI workflows, with a Figma host API test
  double for the plugin main runtime and a separate real-canvas visual comparison.

Use `npm run verify` for typecheck, unit tests, and build. Use `npm run test:browser` for browser-backed conversion tests.
Use `npm run test:e2e` for complete capture/export/import/render workflows.
The [E2E guide](e2e/README.md) documents real Figma screenshot acceptance.

## Extension Points

Future CSS or node support should usually follow this path:

1. Add or extend schema fields in `src/schema/types.ts`.
2. Normalize browser input in `src/convert/styles.ts` or `src/convert/dom.ts`.
3. Map the new AST fields in `src/render/apply-style.ts` or `src/render/create-node.ts`.
4. Add focused unit tests and browser tests when layout or computed style is involved.

Keep unsupported behavior visible through warnings instead of silently dropping it.
