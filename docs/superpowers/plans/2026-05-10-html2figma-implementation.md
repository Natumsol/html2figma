# html2figma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript library with `convert` for browser DOM-to-AST conversion and `render` for Figma plugin AST-to-node rendering.

**Architecture:** Use a single npm package with separate public entrypoints for `html2figma/convert`, `html2figma/render`, and shared schema exports from `html2figma`. Keep browser-only DOM code out of the render entrypoint and keep Figma plugin globals out of the convert entrypoint. Implement the first version around a serializable AST, warning-first degradation, focused CSS utilities, and a mockable render adapter.

**Tech Stack:** TypeScript, tsup, Vitest, Playwright for browser-backed conversion tests, Figma Plugin API types, npm package exports.

---

## File Structure

- Create `package.json`: npm metadata, package exports, scripts, dev dependencies.
- Create `tsconfig.json`: strict TypeScript config.
- Create `tsup.config.ts`: builds root, convert, and render entrypoints.
- Create `vitest.config.ts`: unit test config.
- Create `playwright.config.ts`: browser conversion test config.
- Create `src/index.ts`: shared type exports.
- Create `src/convert.ts`: public browser conversion entrypoint.
- Create `src/render.ts`: public Figma render entrypoint.
- Create `src/schema/types.ts`: AST, warning, resource, option, and result types.
- Create `src/utils/color.ts`: CSS color parsing and Figma RGB normalization.
- Create `src/utils/length.ts`: CSS length parsing helpers.
- Create `src/utils/shadow.ts`: box-shadow parser.
- Create `src/utils/font.ts`: font family and weight mapping helpers.
- Create `src/utils/warnings.ts`: warning factory helpers.
- Create `src/convert/dom.ts`: DOM traversal and node classification.
- Create `src/convert/styles.ts`: computed CSS extraction.
- Create `src/convert/layout.ts`: bounds, flex metadata, and z-index sorting helpers.
- Create `src/render/adapter.ts`: minimal Figma adapter interface.
- Create `src/render/figma-adapter.ts`: real adapter backed by `figma`.
- Create `src/render/create-node.ts`: AST node to Figma node creation.
- Create `src/render/apply-style.ts`: Figma property application.
- Create `src/render/fonts.ts`: font loading and fallback.
- Create `src/render/images.ts`: image resource loading.
- Create `tests/unit/*.test.ts`: focused utility and render tests.
- Create `tests/fixtures/basic-card.html`: fixture for browser conversion.
- Create `tests/browser/convert.spec.ts`: Playwright-backed conversion test.
- Create `README.md`: first-version usage and support notes.

---

### Task 1: Package Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/index.ts`
- Create: `src/convert.ts`
- Create: `src/render.ts`

- [ ] **Step 1: Create the package and build configuration**

Add `package.json`:

```json
{
  "name": "html2figma",
  "version": "0.1.0",
  "description": "Convert browser HTML DOM into serializable Figma node data and render it in Figma plugins.",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./convert": {
      "types": "./dist/convert.d.ts",
      "import": "./dist/convert.js",
      "require": "./dist/convert.cjs"
    },
    "./render": {
      "types": "./dist/render.d.ts",
      "import": "./dist/render.js",
      "require": "./dist/render.cjs"
    }
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:browser": "playwright test",
    "verify": "npm run typecheck && npm run test && npm run build"
  },
  "keywords": [
    "figma",
    "html",
    "css",
    "typescript"
  ],
  "license": "MIT",
  "devDependencies": {
    "@figma/plugin-typings": "^1.108.0",
    "@playwright/test": "^1.52.0",
    "tsup": "^8.4.0",
    "typescript": "^5.8.3",
    "vitest": "^3.1.3"
  }
}
```

Add `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "lib": ["ES2022", "DOM"],
    "types": ["@figma/plugin-typings"],
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["src", "tests", "*.config.ts"],
  "exclude": ["dist", "node_modules"]
}
```

Add `tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    convert: "src/convert.ts",
    render: "src/render.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "es2022"
});
```

Add `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"]
  }
});
```

Add `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  use: {
    ...devices["Desktop Chrome"]
  },
  webServer: undefined
});
```

- [ ] **Step 2: Add temporary public entrypoints that compile**

Add `src/index.ts`:

```ts
export type {
  AstBounds,
  AstStyle,
  ConvertOptions,
  ConvertWarning,
  Html2FigmaDocument,
  Html2FigmaNode,
  RenderOptions,
  RenderResult,
  RenderWarning,
  ResourceRef
} from "./schema/types";
```

Add `src/convert.ts`:

```ts
import type { ConvertOptions, Html2FigmaDocument } from "./schema/types";

export function convert(input: Element | Document, options: ConvertOptions = {}): Html2FigmaDocument {
  void input;
  void options;
  throw new Error("convert requires the DOM conversion task");
}
```

Add `src/render.ts`:

```ts
import type { Html2FigmaDocument, RenderOptions, RenderResult } from "./schema/types";

export async function render(document: Html2FigmaDocument, options: RenderOptions = {}): Promise<RenderResult> {
  void document;
  void options;
  throw new Error("render requires the Figma rendering task");
}
```

- [ ] **Step 3: Run installation and verify the expected type failure**

Run:

```bash
npm install
npm run typecheck
```

Expected: `npm install` succeeds. `npm run typecheck` fails because `src/schema/types.ts` has not been created.

- [ ] **Step 4: Commit the scaffold**

```bash
git add package.json package-lock.json tsconfig.json tsup.config.ts vitest.config.ts playwright.config.ts src/index.ts src/convert.ts src/render.ts
git commit -m "chore: scaffold TypeScript package"
```

---

### Task 2: Shared Schema

**Files:**
- Create: `src/schema/types.ts`
- Test: `tests/unit/schema.test.ts`

- [ ] **Step 1: Write schema tests**

Add `tests/unit/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Html2FigmaDocument } from "../../src";

describe("schema", () => {
  it("allows a serializable document with frame and text nodes", () => {
    const document: Html2FigmaDocument = {
      version: 1,
      root: {
        id: "node-1",
        type: "frame",
        name: "Body",
        bounds: { x: 0, y: 0, width: 320, height: 120 },
        style: { fills: [{ type: "solid", color: { r: 1, g: 1, b: 1 }, opacity: 1 }] },
        source: { tagName: "body", path: "body" },
        warnings: [],
        children: [
          {
            id: "node-2",
            type: "text",
            name: "Text",
            text: "Hello",
            bounds: { x: 16, y: 16, width: 100, height: 24 },
            style: {
              text: {
                fontFamily: "Inter",
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 24,
                color: { r: 0, g: 0, b: 0 },
                textAlign: "left"
              }
            },
            source: { tagName: "#text", path: "body > #text" },
            warnings: [],
            children: []
          }
        ]
      },
      resources: [],
      warnings: [],
      metadata: {
        viewport: { width: 320, height: 240 },
        createdAt: "2026-05-10T00:00:00.000Z"
      }
    };

    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });
});
```

- [ ] **Step 2: Run the schema test to verify it fails**

Run:

```bash
npm run test -- tests/unit/schema.test.ts
```

Expected: FAIL with a module resolution error for `../../src/schema/types`.

- [ ] **Step 3: Add shared AST types**

Add `src/schema/types.ts`:

```ts
export type NodeId = string;

export type AstBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Rgb = {
  r: number;
  g: number;
  b: number;
};

export type SolidFill = {
  type: "solid";
  color: Rgb;
  opacity: number;
};

export type ImageFill = {
  type: "image";
  resourceId: string;
  opacity: number;
  scaleMode: "fill" | "fit" | "crop" | "tile";
};

export type AstFill = SolidFill | ImageFill;

export type AstStroke = {
  color: Rgb;
  opacity: number;
  weight: number;
  align: "inside" | "center" | "outside";
};

export type AstShadow = {
  type: "drop-shadow";
  color: Rgb;
  opacity: number;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
};

export type AstTextStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: "normal" | "italic";
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: "left" | "center" | "right" | "justified";
  textDecoration?: "none" | "underline" | "strikethrough";
  color?: Rgb;
};

export type AstFlexLayout = {
  mode: "horizontal" | "vertical";
  gap: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  primaryAxisAlignItems: "min" | "center" | "max" | "space-between";
  counterAxisAlignItems: "min" | "center" | "max";
  wraps: boolean;
};

export type AstStyle = {
  opacity?: number;
  fills?: AstFill[];
  strokes?: AstStroke[];
  cornerRadius?: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  };
  effects?: AstShadow[];
  text?: AstTextStyle;
  layout?: AstFlexLayout;
};

export type WarningSeverity = "info" | "warning" | "error";

export type ConvertWarning = {
  code: string;
  message: string;
  severity: WarningSeverity;
  nodeId?: string;
  cssProperty?: string;
  source?: string;
};

export type RenderWarning = ConvertWarning;

export type ResourceRef = {
  id: string;
  type: "image" | "svg";
  source: string;
  data?: string;
  mimeType?: string;
};

export type AstSource = {
  tagName: string;
  path: string;
};

export type BaseAstNode = {
  id: NodeId;
  name: string;
  bounds: AstBounds;
  style: AstStyle;
  source: AstSource;
  warnings: ConvertWarning[];
  children: Html2FigmaNode[];
};

export type FrameAstNode = BaseAstNode & {
  type: "frame";
};

export type TextAstNode = BaseAstNode & {
  type: "text";
  text: string;
};

export type RectangleAstNode = BaseAstNode & {
  type: "rectangle";
};

export type ImageAstNode = BaseAstNode & {
  type: "image";
  resourceId: string;
  alt?: string;
};

export type SvgAstNode = BaseAstNode & {
  type: "svg";
  resourceId: string;
};

export type Html2FigmaNode =
  | FrameAstNode
  | TextAstNode
  | RectangleAstNode
  | ImageAstNode
  | SvgAstNode;

export type Html2FigmaDocument = {
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

export type ConvertOptions = {
  strict?: boolean;
  includeHidden?: boolean;
  preserveTextNodes?: boolean;
  maxDepth?: number;
};

export type RenderOptions = {
  parent?: BaseNode & ChildrenMixin;
  x?: number;
  y?: number;
  loadFonts?: boolean;
};

export type RenderResult = {
  root: SceneNode;
  nodes: SceneNode[];
  warnings: RenderWarning[];
};
```

- [ ] **Step 4: Run schema test and typecheck**

Run:

```bash
npm run test -- tests/unit/schema.test.ts
npm run typecheck
```

Expected: PASS for the schema test. Typecheck may still fail only if package versions expose incompatible Figma typings; fix import-free type references by relying on global Figma types from `@figma/plugin-typings`.

- [ ] **Step 5: Commit schema**

```bash
git add src/schema/types.ts tests/unit/schema.test.ts src/index.ts
git commit -m "feat: define shared AST schema"
```

---

### Task 3: CSS Utility Layer

**Files:**
- Create: `src/utils/color.ts`
- Create: `src/utils/length.ts`
- Create: `src/utils/shadow.ts`
- Create: `src/utils/font.ts`
- Create: `src/utils/warnings.ts`
- Test: `tests/unit/color.test.ts`
- Test: `tests/unit/length.test.ts`
- Test: `tests/unit/shadow.test.ts`

- [ ] **Step 1: Write failing utility tests**

Add `tests/unit/color.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCssColor } from "../../src/utils/color";

describe("parseCssColor", () => {
  it("parses rgb colors into normalized Figma RGB values", () => {
    expect(parseCssColor("rgb(255, 128, 0)")).toEqual({
      color: { r: 1, g: 128 / 255, b: 0 },
      opacity: 1
    });
  });

  it("parses rgba opacity", () => {
    expect(parseCssColor("rgba(10, 20, 30, 0.5)")).toEqual({
      color: { r: 10 / 255, g: 20 / 255, b: 30 / 255 },
      opacity: 0.5
    });
  });

  it("returns undefined for transparent", () => {
    expect(parseCssColor("rgba(0, 0, 0, 0)")).toBeUndefined();
    expect(parseCssColor("transparent")).toBeUndefined();
  });
});
```

Add `tests/unit/length.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parsePx, parseOptionalPx } from "../../src/utils/length";

describe("length utilities", () => {
  it("parses px values", () => {
    expect(parsePx("12px")).toBe(12);
    expect(parsePx("0px")).toBe(0);
  });

  it("uses fallback for non-px values", () => {
    expect(parseOptionalPx("auto", 7)).toBe(7);
    expect(parseOptionalPx("calc(100% - 4px)", 3)).toBe(3);
  });
});
```

Add `tests/unit/shadow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseBoxShadow } from "../../src/utils/shadow";

describe("parseBoxShadow", () => {
  it("parses a simple rgba drop shadow", () => {
    expect(parseBoxShadow("rgba(0, 0, 0, 0.25) 0px 4px 12px 0px")).toEqual([
      {
        type: "drop-shadow",
        color: { r: 0, g: 0, b: 0 },
        opacity: 0.25,
        offsetX: 0,
        offsetY: 4,
        blur: 12,
        spread: 0
      }
    ]);
  });

  it("ignores inset shadows in the first version", () => {
    expect(parseBoxShadow("inset rgba(0, 0, 0, 0.2) 0px 1px 2px")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run utility tests to verify they fail**

Run:

```bash
npm run test -- tests/unit/color.test.ts tests/unit/length.test.ts tests/unit/shadow.test.ts
```

Expected: FAIL because utility modules do not exist.

- [ ] **Step 3: Implement CSS utilities**

Add `src/utils/color.ts`:

```ts
import type { Rgb } from "../schema/types";

export type ParsedCssColor = {
  color: Rgb;
  opacity: number;
};

export function parseCssColor(value: string): ParsedCssColor | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "transparent") {
    return undefined;
  }

  const match = normalized.match(/^rgba?\(([^)]+)\)$/);
  if (!match) {
    return undefined;
  }

  const parts = match[1].split(",").map((part) => part.trim());
  if (parts.length < 3) {
    return undefined;
  }

  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const opacity = parts[3] === undefined ? 1 : Number(parts[3]);

  if (![r, g, b, opacity].every(Number.isFinite) || opacity <= 0) {
    return undefined;
  }

  return {
    color: {
      r: clamp01(r / 255),
      g: clamp01(g / 255),
      b: clamp01(b / 255)
    },
    opacity: clamp01(opacity)
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
```

Add `src/utils/length.ts`:

```ts
export function parsePx(value: string): number | undefined {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!match) {
    return undefined;
  }
  return Number(match[1]);
}

export function parseOptionalPx(value: string, fallback = 0): number {
  return parsePx(value) ?? fallback;
}
```

Add `src/utils/shadow.ts`:

```ts
import type { AstShadow } from "../schema/types";
import { parseCssColor } from "./color";

export function parseBoxShadow(value: string): AstShadow[] {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "none") {
    return [];
  }

  return splitShadowList(trimmed)
    .filter((shadow) => !shadow.includes("inset"))
    .map(parseSingleShadow)
    .filter((shadow): shadow is AstShadow => shadow !== undefined);
}

function parseSingleShadow(value: string): AstShadow | undefined {
  const colorMatch = value.match(/rgba?\([^)]+\)/);
  if (!colorMatch) {
    return undefined;
  }

  const parsedColor = parseCssColor(colorMatch[0]);
  if (!parsedColor) {
    return undefined;
  }

  const lengthParts = value
    .replace(colorMatch[0], "")
    .trim()
    .split(/\s+/)
    .map((part) => Number(part.replace("px", "")))
    .filter(Number.isFinite);

  if (lengthParts.length < 2) {
    return undefined;
  }

  return {
    type: "drop-shadow",
    color: parsedColor.color,
    opacity: parsedColor.opacity,
    offsetX: lengthParts[0],
    offsetY: lengthParts[1],
    blur: lengthParts[2] ?? 0,
    spread: lengthParts[3] ?? 0
  };
}

function splitShadowList(value: string): string[] {
  const shadows: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      shadows.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    shadows.push(current.trim());
  }

  return shadows;
}
```

Add `src/utils/font.ts`:

```ts
export function firstFontFamily(fontFamily: string): string {
  const first = fontFamily.split(",")[0]?.trim() || "Inter";
  return first.replace(/^["']|["']$/g, "");
}

export function normalizeFontWeight(value: string): number {
  if (value === "normal") return 400;
  if (value === "bold") return 700;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 400;
}
```

Add `src/utils/warnings.ts`:

```ts
import type { ConvertWarning, WarningSeverity } from "../schema/types";

export function createWarning(
  code: string,
  message: string,
  severity: WarningSeverity = "warning",
  extra: Omit<Partial<ConvertWarning>, "code" | "message" | "severity"> = {}
): ConvertWarning {
  return {
    code,
    message,
    severity,
    ...extra
  };
}
```

- [ ] **Step 4: Run utility tests**

Run:

```bash
npm run test -- tests/unit/color.test.ts tests/unit/length.test.ts tests/unit/shadow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit utilities**

```bash
git add src/utils tests/unit/color.test.ts tests/unit/length.test.ts tests/unit/shadow.test.ts
git commit -m "feat: add CSS utility parsers"
```

---

### Task 4: Browser DOM Conversion Core

**Files:**
- Modify: `src/convert.ts`
- Create: `src/convert/dom.ts`
- Create: `src/convert/layout.ts`
- Create: `src/convert/styles.ts`
- Test: `tests/browser/convert.spec.ts`
- Create: `tests/fixtures/basic-card.html`

- [ ] **Step 1: Add browser conversion fixture**

Add `tests/fixtures/basic-card.html`:

```html
<!doctype html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        font-family: Inter, Arial, sans-serif;
      }

      .card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 240px;
        padding: 16px;
        background: rgb(255, 255, 255);
        border: 1px solid rgb(220, 220, 220);
        border-radius: 12px;
        box-shadow: rgba(0, 0, 0, 0.2) 0px 4px 12px 0px;
      }

      .title {
        font-size: 20px;
        line-height: 28px;
        font-weight: 700;
        color: rgb(20, 20, 20);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="title">Hello Figma</div>
    </div>
  </body>
</html>
```

- [ ] **Step 2: Write failing browser conversion test**

Add `tests/browser/convert.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("converts a basic styled card into an AST", async ({ page }) => {
  const fixtureUrl = pathToFileURL(path.resolve("tests/fixtures/basic-card.html")).toString();
  await page.goto(fixtureUrl);

  const result = await page.evaluate(async () => {
    const module = await import("../../src/convert.ts");
    return module.convert(document.querySelector(".card")!);
  });

  expect(result.version).toBe(1);
  expect(result.root.type).toBe("frame");
  expect(result.root.name).toContain("div");
  expect(result.root.bounds.width).toBeGreaterThan(200);
  expect(result.root.style.fills?.[0]).toMatchObject({ type: "solid", opacity: 1 });
  expect(result.root.style.layout).toMatchObject({ mode: "vertical", gap: 8 });
  expect(result.root.children[0]).toMatchObject({
    type: "frame",
    children: [
      expect.objectContaining({
        type: "text",
        text: "Hello Figma"
      })
    ]
  });
});
```

- [ ] **Step 3: Run browser test to verify it fails**

Run:

```bash
npm run test:browser -- tests/browser/convert.spec.ts
```

Expected: FAIL because `convert` still throws `convert requires the DOM conversion task`.

- [ ] **Step 4: Implement conversion modules**

Add `src/convert/layout.ts`:

```ts
import type { AstBounds, AstFlexLayout } from "../schema/types";
import { parseOptionalPx } from "../utils/length";

export function readBounds(element: Element): AstBounds {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

export function readFlexLayout(style: CSSStyleDeclaration): AstFlexLayout | undefined {
  if (style.display !== "flex" && style.display !== "inline-flex") {
    return undefined;
  }

  return {
    mode: style.flexDirection.startsWith("row") ? "horizontal" : "vertical",
    gap: parseOptionalPx(style.gap, 0),
    padding: {
      top: parseOptionalPx(style.paddingTop, 0),
      right: parseOptionalPx(style.paddingRight, 0),
      bottom: parseOptionalPx(style.paddingBottom, 0),
      left: parseOptionalPx(style.paddingLeft, 0)
    },
    primaryAxisAlignItems: mapJustifyContent(style.justifyContent),
    counterAxisAlignItems: mapAlignItems(style.alignItems),
    wraps: style.flexWrap !== "nowrap"
  };
}

function mapJustifyContent(value: string): AstFlexLayout["primaryAxisAlignItems"] {
  if (value === "center") return "center";
  if (value === "flex-end" || value === "end") return "max";
  if (value === "space-between") return "space-between";
  return "min";
}

function mapAlignItems(value: string): AstFlexLayout["counterAxisAlignItems"] {
  if (value === "center") return "center";
  if (value === "flex-end" || value === "end") return "max";
  return "min";
}
```

Add `src/convert/styles.ts`:

```ts
import type { AstStyle, ConvertWarning } from "../schema/types";
import { parseCssColor } from "../utils/color";
import { parseOptionalPx } from "../utils/length";
import { parseBoxShadow } from "../utils/shadow";
import { firstFontFamily, normalizeFontWeight } from "../utils/font";
import { createWarning } from "../utils/warnings";
import { readFlexLayout } from "./layout";

export function readStyle(element: Element, nodeId: string): { style: AstStyle; warnings: ConvertWarning[] } {
  const computed = window.getComputedStyle(element);
  const warnings: ConvertWarning[] = [];
  const astStyle: AstStyle = {};

  const background = parseCssColor(computed.backgroundColor);
  if (background) {
    astStyle.fills = [{ type: "solid", color: background.color, opacity: background.opacity }];
  }

  const borderColor = parseCssColor(computed.borderTopColor);
  const borderWidth = parseOptionalPx(computed.borderTopWidth, 0);
  if (borderColor && borderWidth > 0 && computed.borderTopStyle === "solid") {
    astStyle.strokes = [
      {
        color: borderColor.color,
        opacity: borderColor.opacity,
        weight: borderWidth,
        align: "inside"
      }
    ];
  }

  astStyle.cornerRadius = {
    topLeft: parseOptionalPx(computed.borderTopLeftRadius, 0),
    topRight: parseOptionalPx(computed.borderTopRightRadius, 0),
    bottomRight: parseOptionalPx(computed.borderBottomRightRadius, 0),
    bottomLeft: parseOptionalPx(computed.borderBottomLeftRadius, 0)
  };

  const opacity = Number(computed.opacity);
  if (Number.isFinite(opacity) && opacity < 1) {
    astStyle.opacity = opacity;
  }

  const effects = parseBoxShadow(computed.boxShadow);
  if (effects.length > 0) {
    astStyle.effects = effects;
  }

  const color = parseCssColor(computed.color);
  astStyle.text = {
    fontFamily: firstFontFamily(computed.fontFamily),
    fontSize: parseOptionalPx(computed.fontSize, 16),
    fontWeight: normalizeFontWeight(computed.fontWeight),
    fontStyle: computed.fontStyle === "italic" ? "italic" : "normal",
    lineHeight: parseOptionalPx(computed.lineHeight, parseOptionalPx(computed.fontSize, 16)),
    letterSpacing: parseOptionalPx(computed.letterSpacing, 0),
    textAlign: mapTextAlign(computed.textAlign),
    textDecoration: computed.textDecorationLine.includes("underline") ? "underline" : "none",
    color: color?.color
  };

  const layout = readFlexLayout(computed);
  if (layout) {
    astStyle.layout = layout;
  }

  if (computed.display === "grid") {
    warnings.push(createWarning("unsupported-css-grid", "CSS grid is not supported in the first version.", "warning", { nodeId, cssProperty: "display" }));
  }

  if (computed.transform && computed.transform !== "none") {
    warnings.push(createWarning("unsupported-transform", "CSS transform is not supported in the first version.", "warning", { nodeId, cssProperty: "transform" }));
  }

  return { style: astStyle, warnings };
}

function mapTextAlign(value: string): NonNullable<AstStyle["text"]>["textAlign"] {
  if (value === "center") return "center";
  if (value === "right" || value === "end") return "right";
  if (value === "justify") return "justified";
  return "left";
}
```

Add `src/convert/dom.ts`:

```ts
import type { ConvertOptions, ConvertWarning, Html2FigmaNode, ResourceRef } from "../schema/types";
import { readBounds } from "./layout";
import { readStyle } from "./styles";

export type ConvertContext = {
  options: ConvertOptions;
  resources: ResourceRef[];
  warnings: ConvertWarning[];
  nextId: () => string;
};

export function convertElement(element: Element, context: ConvertContext, depth = 0): Html2FigmaNode | undefined {
  if (context.options.maxDepth !== undefined && depth > context.options.maxDepth) {
    return undefined;
  }

  const nodeId = context.nextId();
  const computed = window.getComputedStyle(element);
  if (!context.options.includeHidden && (computed.display === "none" || computed.visibility === "hidden")) {
    return undefined;
  }

  const { style, warnings } = readStyle(element, nodeId);
  context.warnings.push(...warnings);

  const children = Array.from(element.childNodes)
    .map((child) => convertChild(child, context, depth + 1))
    .filter((node): node is Html2FigmaNode => node !== undefined);

  if (element instanceof HTMLImageElement) {
    const resourceId = `resource-${context.resources.length + 1}`;
    context.resources.push({ id: resourceId, type: "image", source: element.currentSrc || element.src });
    return {
      id: nodeId,
      type: "image",
      name: readableName(element),
      resourceId,
      alt: element.alt || undefined,
      bounds: readBounds(element),
      style,
      source: { tagName: element.tagName.toLowerCase(), path: cssPath(element) },
      warnings,
      children: []
    };
  }

  if (element instanceof SVGElement) {
    const resourceId = `resource-${context.resources.length + 1}`;
    context.resources.push({ id: resourceId, type: "svg", source: cssPath(element), data: element.outerHTML, mimeType: "image/svg+xml" });
    return {
      id: nodeId,
      type: "svg",
      name: readableName(element),
      resourceId,
      bounds: readBounds(element),
      style,
      source: { tagName: element.tagName.toLowerCase(), path: cssPath(element) },
      warnings,
      children: []
    };
  }

  return {
    id: nodeId,
    type: children.length === 0 && hasVisualBox(style) ? "rectangle" : "frame",
    name: readableName(element),
    bounds: readBounds(element),
    style,
    source: { tagName: element.tagName.toLowerCase(), path: cssPath(element) },
    warnings,
    children
  };
}

function convertChild(child: ChildNode, context: ConvertContext, depth: number): Html2FigmaNode | undefined {
  if (child.nodeType === Node.TEXT_NODE) {
    const text = child.textContent?.replace(/\s+/g, " ").trim();
    if (!text) return undefined;

    const parent = child.parentElement;
    if (!parent) return undefined;

    const nodeId = context.nextId();
    const { style, warnings } = readStyle(parent, nodeId);
    return {
      id: nodeId,
      type: "text",
      name: "Text",
      text,
      bounds: readBounds(parent),
      style,
      source: { tagName: "#text", path: `${cssPath(parent)} > #text` },
      warnings,
      children: []
    };
  }

  if (child.nodeType === Node.ELEMENT_NODE) {
    return convertElement(child as Element, context, depth);
  }

  return undefined;
}

function hasVisualBox(style: Html2FigmaNode["style"]): boolean {
  return Boolean(style.fills?.length || style.strokes?.length || style.effects?.length);
}

function readableName(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const className = element.getAttribute("class");
  return className ? `${tag}.${className.split(/\s+/).join(".")}` : tag;
}

function cssPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current) {
    parts.unshift(current.tagName.toLowerCase());
    current = current.parentElement;
  }
  return parts.join(" > ");
}
```

Modify `src/convert.ts`:

```ts
import type { ConvertOptions, Html2FigmaDocument } from "./schema/types";
import { convertElement } from "./convert/dom";

export function convert(input: Element | Document, options: ConvertOptions = {}): Html2FigmaDocument {
  const rootElement = input instanceof Document ? input.documentElement : input;
  let idCounter = 0;
  const context = {
    options,
    resources: [],
    warnings: [],
    nextId: () => `node-${++idCounter}`
  };

  const root = convertElement(rootElement, context);
  if (!root) {
    throw new Error("Unable to convert root element");
  }

  return {
    version: 1,
    root,
    resources: context.resources,
    warnings: context.warnings,
    metadata: {
      sourceUrl: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      createdAt: new Date().toISOString()
    }
  };
}
```

- [ ] **Step 5: Run browser conversion test**

Run:

```bash
npm run test:browser -- tests/browser/convert.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit conversion core**

```bash
git add src/convert.ts src/convert tests/fixtures/basic-card.html tests/browser/convert.spec.ts
git commit -m "feat: convert browser DOM to AST"
```

---

### Task 5: Figma Render Adapter and Node Creation

**Files:**
- Modify: `src/render.ts`
- Create: `src/render/adapter.ts`
- Create: `src/render/figma-adapter.ts`
- Create: `src/render/create-node.ts`
- Create: `src/render/apply-style.ts`
- Test: `tests/unit/render.test.ts`

- [ ] **Step 1: Write render test with a fake adapter**

Add `tests/unit/render.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Html2FigmaDocument } from "../../src";
import { renderWithAdapter } from "../../src/render/create-node";
import type { FigmaAdapter, RenderableNode } from "../../src/render/adapter";

describe("renderWithAdapter", () => {
  it("creates frame and text nodes from AST", async () => {
    const created: RenderableNode[] = [];
    const adapter: FigmaAdapter = {
      currentPage: fakeNode("page"),
      createFrame: () => push(fakeNode("FRAME")),
      createRectangle: () => push(fakeNode("RECTANGLE")),
      createText: () => push(fakeNode("TEXT")),
      createNodeFromSvg: () => push(fakeNode("SVG")),
      appendChild: (parent, child) => parent.children.push(child),
      loadFontAsync: async () => undefined,
      createImageAsync: async () => "image-hash"
    };

    function push(node: RenderableNode): RenderableNode {
      created.push(node);
      return node;
    }

    const document: Html2FigmaDocument = {
      version: 1,
      resources: [],
      warnings: [],
      metadata: { viewport: { width: 320, height: 240 }, createdAt: "2026-05-10T00:00:00.000Z" },
      root: {
        id: "node-1",
        type: "frame",
        name: "Card",
        bounds: { x: 0, y: 0, width: 240, height: 120 },
        style: { layout: { mode: "vertical", gap: 8, padding: { top: 16, right: 16, bottom: 16, left: 16 }, primaryAxisAlignItems: "min", counterAxisAlignItems: "min", wraps: false } },
        source: { tagName: "div", path: "html > body > div" },
        warnings: [],
        children: [
          {
            id: "node-2",
            type: "text",
            name: "Text",
            text: "Hello",
            bounds: { x: 16, y: 16, width: 64, height: 24 },
            style: { text: { fontFamily: "Inter", fontSize: 16, fontWeight: 400, lineHeight: 24, color: { r: 0, g: 0, b: 0 } } },
            source: { tagName: "#text", path: "html > body > div > #text" },
            warnings: [],
            children: []
          }
        ]
      }
    };

    const result = await renderWithAdapter(document, adapter, { loadFonts: true });

    expect(result.root.type).toBe("FRAME");
    expect(created.map((node) => node.type)).toEqual(["FRAME", "TEXT"]);
    expect(created[0].children).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });
});

function fakeNode(type: string): RenderableNode {
  return {
    type,
    name: "",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    children: [],
    fills: [],
    strokes: [],
    effects: []
  };
}
```

- [ ] **Step 2: Run render test to verify it fails**

Run:

```bash
npm run test -- tests/unit/render.test.ts
```

Expected: FAIL because render modules do not exist.

- [ ] **Step 3: Implement adapter and render creation**

Add `src/render/adapter.ts`:

```ts
export type RenderableNode = {
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: RenderableNode[];
  fills: unknown[];
  strokes: unknown[];
  effects: unknown[];
  [key: string]: unknown;
};

export type FigmaAdapter = {
  currentPage: RenderableNode;
  createFrame(): RenderableNode;
  createRectangle(): RenderableNode;
  createText(): RenderableNode;
  createNodeFromSvg(svg: string): RenderableNode;
  appendChild(parent: RenderableNode, child: RenderableNode): void;
  loadFontAsync(fontName: { family: string; style: string }): Promise<void>;
  createImageAsync(source: string): Promise<string>;
};
```

Add `src/render/apply-style.ts`:

```ts
import type { AstStyle, Html2FigmaNode } from "../schema/types";
import type { RenderableNode } from "./adapter";

export function applyBaseProperties(target: RenderableNode, source: Html2FigmaNode): void {
  target.name = source.name;
  target.x = source.bounds.x;
  target.y = source.bounds.y;
  target.width = source.bounds.width;
  target.height = source.bounds.height;
  applyStyle(target, source.style);
}

export function applyStyle(target: RenderableNode, style: AstStyle): void {
  if (style.opacity !== undefined) {
    target.opacity = style.opacity;
  }

  if (style.fills) {
    target.fills = style.fills.map((fill) => {
      if (fill.type === "solid") {
        return {
          type: "SOLID",
          color: fill.color,
          opacity: fill.opacity
        };
      }
      return {
        type: "IMAGE",
        imageHash: fill.resourceId,
        scaleMode: fill.scaleMode.toUpperCase()
      };
    });
  }

  if (style.strokes) {
    target.strokes = style.strokes.map((stroke) => ({
      type: "SOLID",
      color: stroke.color,
      opacity: stroke.opacity
    }));
    target.strokeWeight = style.strokes[0]?.weight ?? 0;
  }

  if (style.effects) {
    target.effects = style.effects.map((effect) => ({
      type: "DROP_SHADOW",
      color: { ...effect.color, a: effect.opacity },
      offset: { x: effect.offsetX, y: effect.offsetY },
      radius: effect.blur,
      spread: effect.spread,
      visible: true,
      blendMode: "NORMAL"
    }));
  }

  if (style.cornerRadius) {
    target.topLeftRadius = style.cornerRadius.topLeft;
    target.topRightRadius = style.cornerRadius.topRight;
    target.bottomRightRadius = style.cornerRadius.bottomRight;
    target.bottomLeftRadius = style.cornerRadius.bottomLeft;
  }

  if (style.layout) {
    target.layoutMode = style.layout.mode === "horizontal" ? "HORIZONTAL" : "VERTICAL";
    target.itemSpacing = style.layout.gap;
    target.paddingTop = style.layout.padding.top;
    target.paddingRight = style.layout.padding.right;
    target.paddingBottom = style.layout.padding.bottom;
    target.paddingLeft = style.layout.padding.left;
    target.primaryAxisAlignItems = style.layout.primaryAxisAlignItems.toUpperCase();
    target.counterAxisAlignItems = style.layout.counterAxisAlignItems.toUpperCase();
  }
}
```

Add `src/render/create-node.ts`:

```ts
import type { Html2FigmaDocument, Html2FigmaNode, RenderOptions, RenderResult, RenderWarning } from "../schema/types";
import { createWarning } from "../utils/warnings";
import type { FigmaAdapter, RenderableNode } from "./adapter";
import { applyBaseProperties } from "./apply-style";

export async function renderWithAdapter(
  document: Html2FigmaDocument,
  adapter: FigmaAdapter,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const warnings: RenderWarning[] = [...document.warnings];
  const nodes: RenderableNode[] = [];
  const root = await createRenderableNode(document.root, document, adapter, nodes, warnings, options);
  adapter.appendChild((options.parent as RenderableNode | undefined) ?? adapter.currentPage, root);
  return {
    root: root as unknown as SceneNode,
    nodes: nodes as unknown as SceneNode[],
    warnings
  };
}

async function createRenderableNode(
  source: Html2FigmaNode,
  document: Html2FigmaDocument,
  adapter: FigmaAdapter,
  nodes: RenderableNode[],
  warnings: RenderWarning[],
  options: RenderOptions
): Promise<RenderableNode> {
  const target = createNode(source, document, adapter, warnings);
  nodes.push(target);
  applyBaseProperties(target, source);

  if (source.type === "text") {
    await applyText(target, source, adapter, warnings, options);
  }

  for (const child of source.children) {
    const childNode = await createRenderableNode(child, document, adapter, nodes, warnings, options);
    adapter.appendChild(target, childNode);
  }

  return target;
}

function createNode(
  source: Html2FigmaNode,
  document: Html2FigmaDocument,
  adapter: FigmaAdapter,
  warnings: RenderWarning[]
): RenderableNode {
  if (source.type === "rectangle" || source.type === "image") {
    return adapter.createRectangle();
  }

  if (source.type === "text") {
    return adapter.createText();
  }

  if (source.type === "svg") {
    const resource = document.resources.find((item) => item.id === source.resourceId);
    if (resource?.data) {
      return adapter.createNodeFromSvg(resource.data);
    }
    warnings.push(createWarning("missing-svg-resource", "SVG resource data is missing.", "warning", { nodeId: source.id }));
    return adapter.createFrame();
  }

  return adapter.createFrame();
}

async function applyText(
  target: RenderableNode,
  source: Extract<Html2FigmaNode, { type: "text" }>,
  adapter: FigmaAdapter,
  warnings: RenderWarning[],
  options: RenderOptions
): Promise<void> {
  const textStyle = source.style.text;
  if (options.loadFonts !== false && textStyle) {
    try {
      await adapter.loadFontAsync({ family: textStyle.fontFamily, style: textStyle.fontStyle === "italic" ? "Italic" : "Regular" });
    } catch {
      warnings.push(createWarning("font-load-failed", `Unable to load font ${textStyle.fontFamily}.`, "warning", { nodeId: source.id }));
      await adapter.loadFontAsync({ family: "Inter", style: "Regular" });
    }
  }

  target.characters = source.text;
  if (textStyle) {
    target.fontName = { family: textStyle.fontFamily, style: textStyle.fontStyle === "italic" ? "Italic" : "Regular" };
    target.fontSize = textStyle.fontSize;
    target.lineHeight = textStyle.lineHeight ? { unit: "PIXELS", value: textStyle.lineHeight } : { unit: "AUTO" };
    target.letterSpacing = { unit: "PIXELS", value: textStyle.letterSpacing ?? 0 };
    target.textAlignHorizontal = (textStyle.textAlign ?? "left").toUpperCase();
    if (textStyle.color) {
      target.fills = [{ type: "SOLID", color: textStyle.color }];
    }
  }
}
```

Add `src/render/figma-adapter.ts`:

```ts
import type { FigmaAdapter, RenderableNode } from "./adapter";

export function createFigmaAdapter(figmaApi: PluginAPI = figma): FigmaAdapter {
  return {
    currentPage: figmaApi.currentPage as unknown as RenderableNode,
    createFrame: () => figmaApi.createFrame() as unknown as RenderableNode,
    createRectangle: () => figmaApi.createRectangle() as unknown as RenderableNode,
    createText: () => figmaApi.createText() as unknown as RenderableNode,
    createNodeFromSvg: (svg) => figmaApi.createNodeFromSvg(svg) as unknown as RenderableNode,
    appendChild: (parent, child) => {
      (parent as unknown as ChildrenMixin).appendChild(child as unknown as SceneNode);
    },
    loadFontAsync: (fontName) => figmaApi.loadFontAsync(fontName),
    createImageAsync: async (source) => {
      const response = await fetch(source);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return figmaApi.createImage(bytes).hash;
    }
  };
}
```

Modify `src/render.ts`:

```ts
import type { Html2FigmaDocument, RenderOptions, RenderResult } from "./schema/types";
import { renderWithAdapter } from "./render/create-node";
import { createFigmaAdapter } from "./render/figma-adapter";

export async function render(document: Html2FigmaDocument, options: RenderOptions = {}): Promise<RenderResult> {
  return renderWithAdapter(document, createFigmaAdapter(), options);
}
```

- [ ] **Step 4: Run render test**

Run:

```bash
npm run test -- tests/unit/render.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit render adapter**

```bash
git add src/render.ts src/render tests/unit/render.test.ts
git commit -m "feat: render AST through Figma adapter"
```

---

### Task 6: Image Resources and Unsupported CSS Warnings

**Files:**
- Modify: `src/convert/styles.ts`
- Modify: `src/convert/dom.ts`
- Modify: `src/render/create-node.ts`
- Test: `tests/unit/warnings.test.ts`
- Test: `tests/browser/convert.spec.ts`

- [ ] **Step 1: Add warning unit test**

Add `tests/unit/warnings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createWarning } from "../../src/utils/warnings";

describe("createWarning", () => {
  it("creates structured warnings", () => {
    expect(createWarning("unsupported-transform", "Transform is unsupported.", "warning", {
      nodeId: "node-1",
      cssProperty: "transform"
    })).toEqual({
      code: "unsupported-transform",
      message: "Transform is unsupported.",
      severity: "warning",
      nodeId: "node-1",
      cssProperty: "transform"
    });
  });
});
```

- [ ] **Step 2: Extend browser test for unsupported CSS**

Modify `tests/browser/convert.spec.ts` by adding:

```ts
test("records warnings for unsupported transform", async ({ page }) => {
  await page.setContent(`<div id="target" style="transform: rotate(8deg); width: 100px; height: 50px;">Box</div>`);

  const result = await page.evaluate(async () => {
    const module = await import("../../src/convert.ts");
    return module.convert(document.querySelector("#target")!);
  });

  expect(result.warnings).toEqual([
    expect.objectContaining({
      code: "unsupported-transform",
      cssProperty: "transform"
    })
  ]);
});
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/unit/warnings.test.ts
npm run test:browser -- tests/browser/convert.spec.ts
```

Expected: PASS if Task 4 already emits transform warnings. If browser test fails because computed transform differs by browser, inspect `result.warnings` and update `readStyle` to treat non-empty non-`none` transform as unsupported.

- [ ] **Step 4: Commit warning coverage**

```bash
git add src/convert src/render tests/unit/warnings.test.ts tests/browser/convert.spec.ts
git commit -m "test: cover unsupported CSS warnings"
```

---

### Task 7: Build Verification and README

**Files:**
- Create: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Add README usage documentation**

Add `README.md`:

```md
# html2figma

TypeScript library for converting browser HTML DOM into serializable Figma node data and rendering that data inside a Figma plugin.

## Install

```bash
npm install html2figma
```

## Convert in a browser context

```ts
import { convert } from "html2figma/convert";

const documentAst = convert(document.body, {
  strict: false
});
```

`convert` expects real DOM. It reads computed CSS and layout data from the browser, then returns serializable JSON.

## Render in a Figma plugin main context

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

## First-version CSS support

Supported: common box model properties, solid backgrounds, borders, corner radii, text styles, opacity, box shadows, images, SVG, and simple flex layout.

Unsupported CSS is recorded in warnings. CSS grid, transform, filters, blend modes, pseudo elements, animations, complex gradients, clipping, masks, table layout, and native form control appearance are not first-version targets.
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run verify
npm run test:browser
```

Expected: typecheck, unit tests, build, and browser tests pass.

- [ ] **Step 3: Commit README and verification adjustments**

```bash
git add README.md package.json package-lock.json
git commit -m "docs: add first-version usage guide"
```

---

### Task 8: Final Review

**Files:**
- Read: `docs/superpowers/specs/2026-05-10-html2figma-design.md`
- Read: `README.md`
- Read: `src/index.ts`
- Read: `src/convert.ts`
- Read: `src/render.ts`

- [ ] **Step 1: Confirm spec coverage**

Run:

```bash
rg -n "convert|render|warnings|flex|CSS grid|transform|ResourceRef|Success Criteria" docs/superpowers/specs/2026-05-10-html2figma-design.md README.md src
```

Expected: output shows implementation and README coverage for public API, warnings, flex, unsupported CSS, resources, and success criteria.

- [ ] **Step 2: Run final verification**

Run:

```bash
npm run verify
npm run test:browser
git status --short
```

Expected: all commands pass, and `git status --short` is empty after all task commits.

- [ ] **Step 3: Report completion**

Final report should include:

```md
Implemented the first html2figma library slice:

- Browser `convert` entrypoint with DOM traversal, computed style extraction, layout bounds, text, images, SVG, flex metadata, and warnings.
- Figma `render` entrypoint with adapter-backed node creation, style application, font loading, and hierarchy preservation.
- Unit and browser-backed tests.
- README usage notes.

Verification:
- `npm run verify`
- `npm run test:browser`
```

---

## Plan Self-Review

- Spec coverage: The plan covers package shape, public API, AST schema, DOM conversion, CSS utility support, warnings, render behavior, resources, testing, README, and final verification.
- Completeness scan: The plan contains complete steps and no underspecified instructions.
- Type consistency: Public names match the design spec: `convert`, `render`, `Html2FigmaDocument`, `ResourceRef`, `ConvertWarning`, `RenderResult`, and `RenderOptions`.
