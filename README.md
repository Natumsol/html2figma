# html2figma

TypeScript library for converting browser HTML DOM into serializable Figma node data and rendering it inside a Figma plugin.

## Install

```sh
npm install html2figma
```

## Convert Browser HTML

```ts
import { convert } from "html2figma/convert";

const documentAst = convert(document.body);
```

`convert` expects a real browser DOM node, such as `document.body` or `document.documentElement`. It reads computed CSS and layout data from the live page, so run it in a browser context after the content has rendered.

## Render In A Figma Plugin

```ts
import { render } from "html2figma/render";

const result = await render(documentAst, {
  parent: figma.currentPage,
  x: 0,
  y: 0,
  loadFonts: true
});

console.log(result.root, result.warnings);
```

`render` takes the serialized document returned by `convert` and creates Figma scene nodes under the provided parent. The result includes the root Figma node, all created nodes, and any render warnings.

## Examples

The `example/` workspace contains two demos:

- `example/figma-plugin/`: Figma plugin demo with built-in HTML blocks and an Import JSON tab.
- `example/chrome-extension/`: Chrome extension demo for converting the current page or a selected element into html2figma JSON.

Run the Figma plugin demo:

```bash
cd example
npm install
npm run dev:figma
```

Build the Chrome extension demo:

```bash
cd example
npm install
npm run build
```

Load `example/chrome-extension/dist` through Chrome's Load unpacked flow.

## Development and verification

Install both dependency trees with `npm ci` and `npm ci --prefix example`.
Run `npm run verify:all` before handoff. It builds the library once, checks the
browser/Figma source boundaries and published entrypoint types, runs library
and example tests, builds both examples, then runs browser and UI E2E tests.
The CI workflow uses this same command.

Use `npm --prefix example run build` to build both examples and their library
dependency. `example` workspace app scripts consume an already-built library;
`build:apps` and `check:apps` are orchestration steps for reuse after that build.
The Figma development command builds the library before starting its watchers;
its library watcher does not clean files while the UI/plugin watchers read them.

The package root exports portable AST types and `parseDocumentJson` /
`isHtml2FigmaDocument`. Import Figma-specific `RenderOptions` and `RenderResult`
from `html2figma/render`. The same names at the root are now platform-neutral
generics (`RenderOptions<Parent>`, `RenderResult<Node>`), defaulting to `unknown`;
existing Figma consumers using root result types should update their imports.

Document warnings aggregate node warnings. Rendering merges those warnings by
all fields, preserving separate node diagnostics without counting JSON copies
twice. The import validator checks numeric ranges, unique IDs, and typed resource
references; image retrieval failures remain rendering warnings. Embedded Base64 images are
decoded with the Figma API directly; HTTP image URLs use network loading.

Flex becomes Auto Layout only when supported flow and measured child positions
agree. Reverse/wrapped flow, positioned or reordered children, margins, and other
unrepresentable layouts retain measured absolute positions with a
`flex-layout-fallback` warning.

## End-to-end Tests

The [E2E test project](e2e/README.md) exercises the built Chrome extension,
JSON export/import, and Figma plugin UI and rendering pipeline.

```sh
npm ci
npm ci --prefix example
npx playwright install chromium
npm run test:e2e
```

Run `npm run e2e:visual:prepare` to prepare browser reference screenshots and
scripts that execute this library in a real Figma file. After collecting the
Figma results, `npm run test:e2e:visual` compares the actual canvas pixels.
See the E2E guide for authentication, artifacts, and comparison thresholds.

## First-Version CSS Support

This first version targets common page structure and visual styling:

- Common box model sizing and positioning
- Solid backgrounds
- CSS background images using a single `url(...)`
- Borders, including asymmetric solid borders via generated rectangle layers
- Corner radii
- Text styles, including CSS text transform
- Opacity
- Box shadows
- Images, including responsive image selection via `img.currentSrc`
- Video poster images
- SVG, including local `<use>` expansion
- Open shadow root traversal
- Simple flex layout

Unsupported CSS is recorded in warnings so callers can inspect missing fidelity and decide how strict their workflow should be.

These CSS features are not first-version targets:

- CSS grid
- Transform
- Filters
- Blend modes
- Pseudo elements
- Animations
- Gradients and multiple background layers
- Clipping
- Masks
- Table layout
- Native form control appearance
- Responsive Figma constraints
