# html2figma

TypeScript library for converting browser HTML DOM into serializable Figma node data and rendering it inside a Figma plugin.

## Install

```sh
npm install html2figma
```

## Convert Browser HTML

```ts
import { convert } from "html2figma/convert";

const documentAst = convert(document.body, { strict: false });
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

## First-Version CSS Support

This first version targets common page structure and visual styling:

- Common box model sizing and positioning
- Solid backgrounds
- Borders
- Corner radii
- Text styles
- Opacity
- Box shadows
- Images
- SVG
- Simple flex layout

Unsupported CSS is recorded in warnings so callers can inspect missing fidelity and decide how strict their workflow should be.

These CSS features are not first-version targets:

- CSS grid
- Transform
- Filters
- Blend modes
- Pseudo elements
- Animations
- Complex gradients
- Clipping
- Masks
- Table layout
- Native form control appearance
