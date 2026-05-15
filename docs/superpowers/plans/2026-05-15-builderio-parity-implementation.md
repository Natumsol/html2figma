# BuilderIO Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add high-value BuilderIO-inspired HTML conversion parity features while preserving the existing browser convert / Figma render boundary.

**Architecture:** Keep the current AST as the contract between `convert` and `render`, adding only `AstTextStyle.textCase`. Put pure CSS parsing in `src/utils/`, DOM-dependent conversion in `src/convert/`, and Figma-only behavior in `src/render/`. Use warnings for unsupported or partial cases instead of throwing.

**Tech Stack:** TypeScript, Vitest, Playwright, tsup, Figma plugin typings.

---

## File Structure

- Modify `src/schema/types.ts`: add text case metadata to `AstTextStyle`.
- Modify `src/convert/styles.ts`: parse text transform, background images, border side styles, and related warnings.
- Create `src/utils/background.ts`: parse single CSS background image URLs and detect unsupported forms.
- Create `src/convert/borders.ts`: compare per-side borders and generate rectangle AST nodes for asymmetric borders.
- Modify `src/convert/dom.ts`: skip `picture/source`, convert `video poster`, traverse shadow roots, expand SVG `<use>`, and append generated border nodes.
- Modify `src/render/create-node.ts`: map AST text case to Figma text case.
- Modify `src/render/adapter.ts` and `tests/unit/render.test.ts` only if the adapter test shape needs `textCase`.
- Add or extend tests in `tests/unit/` and `tests/browser/convert.spec.ts`.
- Modify `README.md` and `ARCHITECTURE.md`: update supported and unsupported feature notes.

---

### Task 1: Text Transform Schema And Render Mapping

**Files:**
- Modify: `src/schema/types.ts`
- Modify: `src/convert/styles.ts`
- Modify: `src/render/create-node.ts`
- Test: `tests/browser/convert.spec.ts`
- Test: `tests/unit/render.test.ts`

- [ ] **Step 1: Write failing browser test for text transform extraction**

Add to `tests/browser/convert.spec.ts`:

```ts
test("captures CSS text-transform as AST text case", async ({ page }) => {
  await page.setContent(`
    <div id="target" style="font: 16px/20px Arial; text-transform: uppercase;">
      transformed label
    </div>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const text = result.root.children[0];

  expect(text?.type).toBe("text");
  expect(text?.style.text?.textCase).toBe("upper");
});
```

- [ ] **Step 2: Write failing render unit test for text case**

In `tests/unit/render.test.ts`, add a render case with a text node style containing:

```ts
text: {
  fontFamily: "Inter",
  fontSize: 16,
  fontWeight: 400,
  textCase: "upper"
}
```

Assert the created text node receives:

```ts
expect(textNode.textCase).toBe("UPPER");
```

Run: `npm run test -- tests/unit/render.test.ts`

Expected: FAIL because `textCase` is not in the schema or render mapping.

- [ ] **Step 3: Add schema and conversion mapping**

In `src/schema/types.ts`, extend `AstTextStyle`:

```ts
textCase?: "upper" | "lower" | "title";
```

In `src/convert/styles.ts`, add:

```ts
textStyle.textCase = mapTextTransform(style.textTransform);
```

and define:

```ts
function mapTextTransform(value: string): AstTextStyle["textCase"] | undefined {
  switch (value) {
    case "uppercase":
      return "upper";
    case "lowercase":
      return "lower";
    case "capitalize":
      return "title";
    default:
      return undefined;
  }
}
```

- [ ] **Step 4: Add render mapping**

In `src/render/create-node.ts`, inside `applyTextProperties`, add:

```ts
if (textStyle?.textCase) {
  target.textCase = mapTextCase(textStyle.textCase);
}
```

and define:

```ts
function mapTextCase(value: NonNullable<AstTextStyle["textCase"]>): string {
  switch (value) {
    case "upper":
      return "UPPER";
    case "lower":
      return "LOWER";
    case "title":
      return "TITLE";
  }
}
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run typecheck
npm run test -- tests/unit/render.test.ts
npm run test:browser -- tests/browser/convert.spec.ts
```

Expected: all commands pass.

Commit:

```bash
git add src/schema/types.ts src/convert/styles.ts src/render/create-node.ts tests/browser/convert.spec.ts tests/unit/render.test.ts
git commit -m "feat: map css text transform"
```

---

### Task 2: Background Image URL Fills

**Files:**
- Create: `src/utils/background.ts`
- Modify: `src/convert/styles.ts`
- Test: `tests/unit/background.test.ts`
- Test: `tests/browser/convert.spec.ts`

- [ ] **Step 1: Write failing unit tests**

Create `tests/unit/background.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { parseBackgroundImage } from "../../src/utils/background";

describe("parseBackgroundImage", () => {
  test("parses a single url background image", () => {
    expect(parseBackgroundImage('url("https://example.com/card.png")')).toEqual({
      kind: "url",
      url: "https://example.com/card.png"
    });
  });

  test("rejects gradients", () => {
    expect(parseBackgroundImage("linear-gradient(red, blue)")).toEqual({
      kind: "unsupported",
      reason: "gradient"
    });
  });

  test("rejects multiple background layers", () => {
    expect(parseBackgroundImage('url("a.png"), url("b.png")')).toEqual({
      kind: "unsupported",
      reason: "multiple"
    });
  });
});
```

Run: `npm run test -- tests/unit/background.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 2: Write failing browser test**

Add to `tests/browser/convert.spec.ts`:

```ts
test("converts single CSS background image URLs into image fills", async ({ page }) => {
  await page.setContent(`
    <div id="target" style="
      width: 160px;
      height: 90px;
      background-image: url('https://example.com/card.png');
      background-size: contain;
    "></div>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const fill = result.root.style.fills?.find((item) => item.type === "image");
  expect(fill).toMatchObject({
    type: "image",
    scaleMode: "fit"
  });
  expect(result.resources).toContainEqual(expect.objectContaining({
    type: "image",
    source: "https://example.com/card.png"
  }));
});
```

Add an unsupported case:

```ts
test("warns for unsupported CSS background images", async ({ page }) => {
  await page.setContent(`
    <div id="target" style="width: 100px; height: 50px; background-image: linear-gradient(red, blue);"></div>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  expect(result.warnings).toContainEqual(expect.objectContaining({
    code: "unsupported-background-image",
    cssProperty: "background-image"
  }));
});
```

- [ ] **Step 3: Implement pure parser**

Create `src/utils/background.ts`:

```ts
export type ParsedBackgroundImage =
  | { kind: "none" }
  | { kind: "url"; url: string }
  | { kind: "unsupported"; reason: "gradient" | "multiple" | "unknown" };

export function parseBackgroundImage(value: string): ParsedBackgroundImage {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "none") {
    return { kind: "none" };
  }

  if (hasTopLevelComma(trimmed)) {
    return { kind: "unsupported", reason: "multiple" };
  }

  if (/\b(?:linear|radial|conic)-gradient\(/i.test(trimmed)) {
    return { kind: "unsupported", reason: "gradient" };
  }

  const match = trimmed.match(/^url\((['"]?)(.*?)\1\)$/i);
  if (match?.[2]) {
    return { kind: "url", url: match[2] };
  }

  return { kind: "unsupported", reason: "unknown" };
}

function hasTopLevelComma(value: string): boolean {
  let depth = 0;
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) return true;
  }
  return false;
}
```

- [ ] **Step 4: Integrate with `readStyle`**

In `src/convert/styles.ts`, import `parseBackgroundImage`. After solid background parsing, parse `computedStyle.backgroundImage`. On URL:

```ts
const resourceId = `resource-${resources.length + 1}`;
resources.push({ id: resourceId, type: "image", source: parsed.url, mimeType: imageMimeType(parsed.url) });
style.fills = (style.fills ?? []).concat({
  type: "image",
  resourceId,
  opacity: 1,
  scaleMode: computedStyle.backgroundSize === "contain" ? "fit" : "fill"
});
```

If `readStyle` does not currently receive `resources`, change its signature to accept context data:

```ts
readStyle(element, id, context.resources)
```

For unsupported values, push:

```ts
createWarning("unsupported-background-image", "CSS background image is not supported", "warning", {
  nodeId,
  cssProperty: "background-image",
  source: computedStyle.backgroundImage
})
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run typecheck
npm run test -- tests/unit/background.test.ts
npm run test:browser -- tests/browser/convert.spec.ts
```

Expected: all commands pass.

Commit:

```bash
git add src/utils/background.ts src/convert/styles.ts src/convert/dom.ts tests/unit/background.test.ts tests/browser/convert.spec.ts
git commit -m "feat: convert css background images"
```

---

### Task 3: Picture, Source, And Video Poster Handling

**Files:**
- Modify: `src/convert/dom.ts`
- Test: `tests/browser/convert.spec.ts`

- [ ] **Step 1: Write failing browser tests**

Add:

```ts
test("skips picture and source wrappers while preserving img currentSrc", async ({ page }) => {
  await page.setContent(`
    <picture id="target">
      <source srcset="wide.png" media="(min-width: 800px)">
      <img src="fallback.png" style="width: 120px; height: 80px;" alt="Fallback">
    </picture>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const nodeTypes = flattenNodeTypes(result.root);
  expect(nodeTypes).not.toContain("source");
  expect(result.resources).toContainEqual(expect.objectContaining({
    type: "image",
    source: expect.stringContaining("fallback.png")
  }));
});

test("converts video poster images into image nodes", async ({ page }) => {
  await page.setContent(`
    <video id="target" poster="poster.jpg" style="width: 200px; height: 120px;"></video>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  expect(result.root.type).toBe("image");
  expect(result.root.source.tagName).toBe("video");
  expect(result.resources).toContainEqual(expect.objectContaining({
    type: "image",
    source: expect.stringContaining("poster.jpg")
  }));
});

test("warns when video has no poster image", async ({ page }) => {
  await page.setContent(`
    <video id="target" style="width: 200px; height: 120px;"></video>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  expect(result.root.type).not.toBe("image");
  expect(result.warnings).toContainEqual(expect.objectContaining({
    code: "video-poster-missing"
  }));
});
```

Run: `npm run test:browser -- tests/browser/convert.spec.ts`

Expected: FAIL for missing video behavior and source skipping.

- [ ] **Step 2: Implement element routing**

In `src/convert/dom.ts`, near the top of `convertElement`, skip source:

```ts
if (element instanceof HTMLSourceElement) {
  return undefined;
}
```

For `HTMLPictureElement`, do not create its own visual resource; allow child traversal. If the root input itself is `picture`, return a frame only when it has converted children.

Add before the image branch:

```ts
if (element instanceof HTMLVideoElement) {
  if (element.poster) {
    const resourceId = `resource-${context.resources.length + 1}`;
    context.resources.push({
      id: resourceId,
      type: "image",
      source: element.poster,
      mimeType: imageMimeType(element.poster)
    });

    return {
      ...baseNode,
      type: "image",
      resourceId,
      alt: undefined
    } satisfies ImageAstNode;
  }

  const warning = createWarning("video-poster-missing", "Video poster is missing; rendering video as a frame", "warning", {
    nodeId: id,
    source: source.path
  });
  context.warnings.push(warning);
  baseNode.warnings.push(warning);
}
```

Import `createWarning`.

- [ ] **Step 3: Verify and commit**

Run:

```bash
npm run typecheck
npm run test:browser -- tests/browser/convert.spec.ts
```

Expected: all commands pass.

Commit:

```bash
git add src/convert/dom.ts tests/browser/convert.spec.ts
git commit -m "feat: convert responsive media elements"
```

---

### Task 4: Shadow DOM Traversal

**Files:**
- Modify: `src/convert/dom.ts`
- Test: `tests/browser/convert.spec.ts`

- [ ] **Step 1: Write failing browser test**

Add:

```ts
test("traverses open shadow roots with source path markers", async ({ page }) => {
  await page.setContent(`<custom-card id="target"></custom-card>`);
  await page.evaluate(() => {
    const host = document.querySelector("#target")!;
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <div class="shadow-title" style="font: 16px/20px Arial;">Shadow title</div>
    `;
  });

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const allPaths = collectSourcePaths(result.root);
  expect(allPaths.some((path) => path.includes("::shadow"))).toBe(true);
  expect(flattenTexts(result.root)).toContain("Shadow title");
});
```

Add helper functions at bottom:

```ts
function collectSourcePaths(node: Html2FigmaDocument["root"]): string[] {
  return [node.source.path, ...node.children.flatMap(collectSourcePaths)];
}

function flattenTexts(node: Html2FigmaDocument["root"]): string[] {
  return [
    ...(node.type === "text" ? [node.text] : []),
    ...node.children.flatMap(flattenTexts)
  ];
}
```

- [ ] **Step 2: Implement shadow traversal**

In `src/convert/dom.ts`, refactor `convertChildren` to accept a `pathPrefix`. After normal child traversal:

```ts
if (element.shadowRoot) {
  children.push(
    ...convertChildNodes(
      Array.from(element.shadowRoot.childNodes),
      context,
      depth,
      parentStyle,
      parentBounds,
      `${parentPath}::shadow`
    )
  );
}
```

Keep child source paths under the shadow marker by passing the prefix into `createTextNode` and `cssPath` generation for shadow elements. For shadow elements, build paths relative to the shadow root because `parentElement` cannot walk through the host:

```ts
function shadowCssPath(element: Element, rootPath: string): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current) {
    parts.unshift(readableName(current));
    current = current.parentElement;
  }
  return `${rootPath} > ${parts.join(" > ")}`;
}
```

- [ ] **Step 3: Verify and commit**

Run:

```bash
npm run typecheck
npm run test:browser -- tests/browser/convert.spec.ts
```

Expected: all commands pass.

Commit:

```bash
git add src/convert/dom.ts tests/browser/convert.spec.ts
git commit -m "feat: traverse open shadow roots"
```

---

### Task 5: SVG Use Expansion

**Files:**
- Modify: `src/convert/dom.ts`
- Test: `tests/browser/convert.spec.ts`

- [ ] **Step 1: Write failing browser test**

Add:

```ts
test("expands local SVG use references before storing resources", async ({ page }) => {
  await page.setContent(`
    <svg style="display: none;">
      <symbol id="check-icon" viewBox="0 0 10 10">
        <path d="M1 5l2 2 6-6"></path>
      </symbol>
    </svg>
    <svg id="target" width="10" height="10">
      <use href="#check-icon"></use>
    </svg>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const svgResource = result.resources.find((resource) => resource.type === "svg");
  expect(svgResource?.data).toContain("<path");
  expect(svgResource?.data).not.toContain("<use");
});
```

- [ ] **Step 2: Implement SVG clone expansion**

In `src/convert/dom.ts`, add helper:

```ts
function serializeSvg(element: SVGElement, context: ConvertContext, nodeId: string): string {
  const clone = element.cloneNode(true) as SVGElement;

  for (const use of Array.from(clone.querySelectorAll("use"))) {
    const href = use.getAttribute("href") || use.getAttribute("xlink:href");
    if (!href?.startsWith("#")) {
      continue;
    }

    const symbol = element.ownerDocument.querySelector(href);
    if (!symbol) {
      context.warnings.push(createWarning("svg-use-unresolved", "SVG use reference could not be resolved", "warning", {
        nodeId,
        source: href
      }));
      continue;
    }

    use.replaceWith(...Array.from(symbol.childNodes).map((child) => child.cloneNode(true)));
  }

  return clone.outerHTML;
}
```

Use `serializeSvg(element, context, id)` instead of `element.outerHTML` when creating SVG resources.

- [ ] **Step 3: Verify and commit**

Run:

```bash
npm run typecheck
npm run test:browser -- tests/browser/convert.spec.ts
```

Expected: all commands pass.

Commit:

```bash
git add src/convert/dom.ts tests/browser/convert.spec.ts
git commit -m "feat: expand svg use references"
```

---

### Task 6: Per-Side Border Rectangles

**Files:**
- Create: `src/convert/borders.ts`
- Modify: `src/convert/dom.ts`
- Modify: `src/convert/styles.ts`
- Test: `tests/unit/borders.test.ts`
- Test: `tests/browser/convert.spec.ts`

- [ ] **Step 1: Write failing unit tests**

Create `tests/unit/borders.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { createBorderRectangleBounds } from "../../src/convert/borders";

describe("createBorderRectangleBounds", () => {
  const bounds = { x: 10, y: 20, width: 100, height: 50 };

  test("creates top border bounds", () => {
    expect(createBorderRectangleBounds("top", bounds, 2)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 2
    });
  });

  test("creates right border bounds", () => {
    expect(createBorderRectangleBounds("right", bounds, 3)).toEqual({
      x: 107,
      y: 20,
      width: 3,
      height: 50
    });
  });
});
```

- [ ] **Step 2: Write failing browser test**

Add:

```ts
test("represents asymmetric solid borders as rectangle children", async ({ page }) => {
  await page.setContent(`
    <div id="target" style="
      width: 100px;
      height: 50px;
      border-top: 2px solid rgb(255, 0, 0);
      border-right: 4px solid rgb(0, 255, 0);
    "></div>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  expect(result.root.children.map((child) => child.name)).toEqual(
    expect.arrayContaining(["#border-top", "#border-right"])
  );
});
```

- [ ] **Step 3: Implement border helper**

Create `src/convert/borders.ts`:

```ts
import type { AstBounds, Html2FigmaNode, Rgb } from "../schema/types";

export type BorderSide = "top" | "right" | "bottom" | "left";

export interface BorderPaint {
  side: BorderSide;
  weight: number;
  color: Rgb;
  opacity: number;
}

export function createBorderRectangleBounds(
  side: BorderSide,
  bounds: AstBounds,
  weight: number
): AstBounds {
  switch (side) {
    case "top":
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: weight };
    case "right":
      return { x: bounds.x + bounds.width - weight, y: bounds.y, width: weight, height: bounds.height };
    case "bottom":
      return { x: bounds.x, y: bounds.y + bounds.height - weight, width: bounds.width, height: weight };
    case "left":
      return { x: bounds.x, y: bounds.y, width: weight, height: bounds.height };
  }
}

export function createBorderRectangleNode(
  parent: Html2FigmaNode,
  side: BorderSide,
  paint: BorderPaint,
  id: string
): Html2FigmaNode {
  return {
    id,
    type: "rectangle",
    name: `#border-${side}`,
    bounds: createBorderRectangleBounds(side, parent.bounds, paint.weight),
    style: {
      fills: [{ type: "solid", color: paint.color, opacity: paint.opacity }]
    },
    source: {
      tagName: "#border",
      path: `${parent.source.path} > #border-${side}`
    },
    warnings: [],
    children: []
  };
}
```

- [ ] **Step 4: Read per-side border paints**

In `src/convert/styles.ts`, add a helper that reads top/right/bottom/left border styles. Return uniform borders as `style.strokes`; return asymmetric border paint metadata to `convertElement` so it can append rectangle children.

Use solid-only parsing:

```ts
const border = readBorderSide(style, "top");
```

For non-solid visible styles, emit `unsupported-border-style`.

- [ ] **Step 5: Append generated border child nodes**

In `src/convert/dom.ts`, after building the parent visual node, append border rectangle nodes when the sides are asymmetric:

```ts
children.push(
  ...borderSides.map((paint) =>
    createBorderRectangleNode(node, paint.side, paint, nextNodeId(context))
  )
);
```

Ensure these helper rectangles are appended after normal children so they visually sit above the fill.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm run typecheck
npm run test -- tests/unit/borders.test.ts
npm run test:browser -- tests/browser/convert.spec.ts
```

Expected: all commands pass.

Commit:

```bash
git add src/convert/borders.ts src/convert/dom.ts src/convert/styles.ts tests/unit/borders.test.ts tests/browser/convert.spec.ts
git commit -m "feat: convert asymmetric borders"
```

---

### Task 7: Documentation And Full Verification

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Update support notes**

In `README.md`, move these items from unsupported or undocumented into supported capabilities:

```md
- CSS background images using a single `url(...)`
- responsive image selection via `img.currentSrc`
- video poster images
- open shadow root traversal
- SVG local `<use>` expansion
- CSS text transform
- asymmetric solid borders via generated rectangle layers
```

Keep these explicitly unsupported:

```md
- CSS grid fidelity
- transforms, filters, blend modes, masks, and clip paths
- gradients and multiple background layers
- responsive Figma constraints
```

- [ ] **Step 2: Update architecture notes**

In `ARCHITECTURE.md`, add a short section under conversion:

```md
Resource-like CSS features are resolved during conversion. Single URL background images become image fill resources, video posters become image nodes, and SVG resources are cloned before local `<use>` expansion. Unsupported resource forms emit warnings and continue.
```

Add a short section under rendering:

```md
Generated helper rectangles, including asymmetric border layers, render through the normal rectangle path. Text case metadata maps directly to Figma text case.
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run verify
npm run test:browser
```

Expected:

```text
typecheck passes
unit tests pass
build passes
browser tests pass
```

- [ ] **Step 4: Commit docs**

Commit:

```bash
git add README.md ARCHITECTURE.md
git commit -m "docs: update conversion support matrix"
```

---

## Final Integration

- [ ] **Step 1: Check clean status**

Run:

```bash
git status --short
```

Expected: no uncommitted files.

- [ ] **Step 2: Run final verification**

Run:

```bash
npm run verify
npm run test:browser
```

Expected: both commands pass.

- [ ] **Step 3: Push**

Run:

```bash
git push origin master
```

Expected: push succeeds.

---

## Self-Review

- Spec coverage: all approved features are covered by Tasks 1 through 7.
- Placeholder scan: no unfinished placeholder markers are intentionally left in the plan.
- Type consistency: `textCase`, `ImageFill`, `ImageAstNode`, `Html2FigmaNode`, and warning codes are named consistently with the design spec.
