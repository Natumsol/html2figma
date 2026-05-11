# Example Extension Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `example/` into separate Figma plugin and Chrome extension demos, where the extension exports `Html2FigmaDocument` JSON and the Figma plugin imports and renders it.

**Architecture:** `example/figma-plugin/` preserves the existing block gallery and adds an `Import JSON` tab. `example/chrome-extension/` is a Manifest V3 app with popup, content script, background worker, and JSON viewer. The two apps share no runtime dependency; they exchange AST documents through clipboard or downloaded JSON.

**Tech Stack:** TypeScript, Vite, npm workspaces, Figma Plugin API, Chrome Extension Manifest V3, Vitest for helper unit tests.

---

## File Structure

- Modify `example/package.json`: convert to a workspace coordinator.
- Move existing files into `example/figma-plugin/`: blocks, config, manifest, Vite configs, scripts, UI and plugin sources.
- Create `example/figma-plugin/src/shared/document.ts`: runtime validation and summary helpers.
- Create `example/figma-plugin/src/shared/document.test.ts`: unit tests for JSON validation and summary helpers.
- Create `example/figma-plugin/vitest.config.ts`: unit test config.
- Modify `example/figma-plugin/src/messages.ts`: add `render-json` message.
- Modify `example/figma-plugin/src/ui/main.ts`: add tabs, paste/upload JSON import flow.
- Modify `example/figma-plugin/src/plugin/main.ts`: handle imported JSON rendering.
- Create `example/chrome-extension/`: Manifest V3 package, build configs, popup, content script, background worker, viewer page, shared helpers.
- Modify `README.md`: document both example apps.

---

### Task 1: Workspace Split and Figma Plugin Migration

**Files:**
- Modify: `example/package.json`
- Move: `example/src/**` to `example/figma-plugin/src/**`
- Move: `example/blocks/**` to `example/figma-plugin/blocks/**`
- Move: `example/index.html` to `example/figma-plugin/index.html`
- Move: `example/example.config.ts` to `example/figma-plugin/example.config.ts`
- Move: `example/scripts/sync-manifest.ts` to `example/figma-plugin/scripts/sync-manifest.ts`
- Move: `example/vite.ui.config.ts` to `example/figma-plugin/vite.ui.config.ts`
- Move: `example/vite.plugin.config.ts` to `example/figma-plugin/vite.plugin.config.ts`
- Move: `example/manifest.json` to `example/figma-plugin/manifest.json`
- Create: `example/figma-plugin/package.json`
- Create: `example/figma-plugin/tsconfig.json`
- Create: `example/figma-plugin/vitest.config.ts`

- [ ] **Step 1: Update root example workspace package**

Replace `example/package.json` with:

```json
{
  "name": "html2figma-example",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "workspaces": [
    "figma-plugin",
    "chrome-extension"
  ],
  "scripts": {
    "build": "npm run build -w figma-plugin && npm run build -w chrome-extension",
    "typecheck": "npm run typecheck -w figma-plugin && npm run typecheck -w chrome-extension",
    "dev:figma": "npm run dev -w figma-plugin",
    "dev:chrome": "npm run dev -w chrome-extension"
  }
}
```

- [ ] **Step 2: Move existing Figma plugin files**

Run:

```bash
mkdir -p example/figma-plugin
git mv example/src example/figma-plugin/src
git mv example/blocks example/figma-plugin/blocks
git mv example/index.html example/figma-plugin/index.html
git mv example/example.config.ts example/figma-plugin/example.config.ts
git mv example/scripts example/figma-plugin/scripts
git mv example/vite.ui.config.ts example/figma-plugin/vite.ui.config.ts
git mv example/vite.plugin.config.ts example/figma-plugin/vite.plugin.config.ts
git mv example/manifest.json example/figma-plugin/manifest.json
```

- [ ] **Step 3: Add Figma plugin package**

Create `example/figma-plugin/package.json`:

```json
{
  "name": "figma-plugin",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run dev:ui\" \"npm run dev:plugin\"",
    "dev:ui": "vite --config vite.ui.config.ts --host localhost --port 5173",
    "dev:plugin": "npm run sync-manifest && vite build --config vite.plugin.config.ts --watch",
    "build": "npm run sync-manifest && vite build --config vite.ui.config.ts && vite build --config vite.plugin.config.ts",
    "sync-manifest": "tsx scripts/sync-manifest.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "html2figma": "file:../.."
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.125.0",
    "@types/node": "^25.6.2",
    "concurrently": "^9.2.1",
    "tsx": "^4.21.0",
    "typescript": "^6.0.3",
    "vitest": "^3.1.3",
    "vite": "^8.0.11"
  }
}
```

Create `example/figma-plugin/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "lib": ["ES2022", "DOM"],
    "types": ["@figma/plugin-typings", "node"]
  },
  "include": ["src", "scripts", "*.config.ts", "example.config.ts"]
}
```

Create `example/figma-plugin/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
```

- [ ] **Step 4: Update moved config paths**

In `example/figma-plugin/scripts/sync-manifest.ts`, keep `exampleRoot = resolve(currentDir, "..")`; this now points to `example/figma-plugin`.

In `example/figma-plugin/vite.ui.config.ts`, keep `root: "."` and `publicDir: "blocks"` because the config now lives beside `blocks/`.

- [ ] **Step 5: Install and verify migrated Figma plugin**

Run:

```bash
cd example
npm install
npm run typecheck -w figma-plugin
npm run build -w figma-plugin
```

Expected: typecheck and build pass, and `example/figma-plugin/dist/` is generated.

- [ ] **Step 6: Commit migration**

```bash
git add example
git commit -m "chore(example): split figma plugin workspace"
```

---

### Task 2: Figma Plugin JSON Import Shared Helpers

**Files:**
- Create: `example/figma-plugin/src/shared/document.ts`
- Create: `example/figma-plugin/src/shared/document.test.ts`
- Modify: `example/figma-plugin/src/messages.ts`

- [ ] **Step 1: Add document validation and summary helpers**

Create `example/figma-plugin/src/shared/document.ts`:

```ts
import type { Html2FigmaDocument, Html2FigmaNode } from "html2figma";

export interface DocumentSummary {
  version: number;
  rootName: string;
  rootType: string;
  nodeCount: number;
  resourceCount: number;
  warningCount: number;
  viewport: string;
}

export function parseDocumentJson(value: string): Html2FigmaDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("JSON could not be parsed.");
  }

  if (!isHtml2FigmaDocument(parsed)) {
    throw new Error("JSON is not a valid html2figma document.");
  }

  return parsed;
}

export function isHtml2FigmaDocument(value: unknown): value is Html2FigmaDocument {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    isHtml2FigmaNode(value.root) &&
    Array.isArray(value.resources) &&
    Array.isArray(value.warnings) &&
    isRecord(value.metadata)
  );
}

export function summarizeDocument(document: Html2FigmaDocument): DocumentSummary {
  return {
    version: document.version,
    rootName: document.root.name,
    rootType: document.root.type,
    nodeCount: countNodes(document.root),
    resourceCount: document.resources.length,
    warningCount: document.warnings.length,
    viewport: `${document.metadata.viewport.width}x${document.metadata.viewport.height}`
  };
}

function countNodes(node: Html2FigmaNode): number {
  return 1 + node.children.reduce((total, child) => total + countNodes(child), 0);
}

function isHtml2FigmaNode(value: unknown): value is Html2FigmaNode {
  if (!isRecord(value)) return false;
  if (!isNodeType(value.type)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isRecord(value.bounds) &&
    isRecord(value.style) &&
    isRecord(value.source) &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.children) &&
    value.children.every(isHtml2FigmaNode)
  );
}

function isNodeType(value: unknown): value is Html2FigmaNode["type"] {
  return value === "frame" || value === "text" || value === "rectangle" || value === "image" || value === "svg";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
```

- [ ] **Step 2: Add document helper tests**

Create `example/figma-plugin/src/shared/document.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Html2FigmaDocument } from "html2figma";
import { parseDocumentJson, summarizeDocument } from "./document";

const documentFixture: Html2FigmaDocument = {
  version: 1,
  root: {
    id: "node-1",
    type: "frame",
    name: "Root",
    bounds: { x: 0, y: 0, width: 320, height: 180 },
    style: {},
    source: { tagName: "body", path: "html > body" },
    warnings: [],
    children: [
      {
        id: "node-2",
        type: "text",
        name: "Text",
        text: "Hello",
        bounds: { x: 12, y: 12, width: 80, height: 20 },
        style: { text: { fontFamily: "Inter", fontSize: 16, fontWeight: 400 } },
        source: { tagName: "#text", path: "html > body > #text" },
        warnings: [],
        children: []
      }
    ]
  },
  resources: [],
  warnings: [],
  metadata: {
    viewport: { width: 1280, height: 720 },
    createdAt: "2026-05-11T00:00:00.000Z"
  }
};

describe("document helpers", () => {
  it("parses valid html2figma JSON", () => {
    expect(parseDocumentJson(JSON.stringify(documentFixture))).toEqual(documentFixture);
  });

  it("rejects invalid JSON and invalid document shapes", () => {
    expect(() => parseDocumentJson("{")).toThrow("JSON could not be parsed.");
    expect(() => parseDocumentJson(JSON.stringify({ version: 1 }))).toThrow("JSON is not a valid html2figma document.");
  });

  it("summarizes document metadata", () => {
    expect(summarizeDocument(documentFixture)).toEqual({
      version: 1,
      rootName: "Root",
      rootType: "frame",
      nodeCount: 2,
      resourceCount: 0,
      warningCount: 0,
      viewport: "1280x720"
    });
  });
});
```

- [ ] **Step 3: Extend plugin message contract**

Modify `example/figma-plugin/src/messages.ts`:

```ts
import type { Html2FigmaDocument } from "html2figma";
import { isHtml2FigmaDocument } from "./shared/document";

export interface RenderBlockMessage {
  type: "render-block";
  blockId: string;
  document: Html2FigmaDocument;
}

export interface RenderJsonMessage {
  type: "render-json";
  source: "paste" | "file";
  document: Html2FigmaDocument;
}

export type UiToPluginMessage = RenderBlockMessage | RenderJsonMessage;

export function isUiToPluginMessage(value: unknown): value is UiToPluginMessage {
  if (!isRecord(value)) return false;

  if (value.type === "render-block") {
    return typeof value.blockId === "string" && isHtml2FigmaDocument(value.document);
  }

  if (value.type === "render-json") {
    return (value.source === "paste" || value.source === "file") && isHtml2FigmaDocument(value.document);
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
```

- [ ] **Step 4: Verify helper types and tests**

Run:

```bash
cd example
npm run typecheck -w figma-plugin
npm run test -w figma-plugin
```

Expected: PASS.

- [ ] **Step 5: Commit helpers**

```bash
git add example/figma-plugin/src/shared/document.ts example/figma-plugin/src/shared/document.test.ts example/figma-plugin/src/messages.ts example/figma-plugin/vitest.config.ts example/figma-plugin/package.json
git commit -m "feat(example): add JSON document validation helpers"
```

---

### Task 3: Figma Plugin Import JSON Tab

**Files:**
- Modify: `example/figma-plugin/src/ui/main.ts`
- Modify: `example/figma-plugin/src/ui/styles.css`
- Modify: `example/figma-plugin/src/plugin/main.ts`

- [ ] **Step 1: Add tabbed UI markup and import controls**

Modify `example/figma-plugin/src/ui/main.ts` so the app shell includes two tab buttons and two panels:

```ts
app.innerHTML = `
  <div class="app">
    <header class="header">
      <div>
        <p class="eyebrow">html2figma example</p>
        <h1>Render HTML blocks into Figma</h1>
        <p class="subtitle">Convert bundled HTML previews or import JSON exported from the Chrome extension.</p>
      </div>
    </header>
    <nav class="tabs" aria-label="Example modes">
      <button type="button" class="tab active" data-tab="blocks">Blocks</button>
      <button type="button" class="tab" data-tab="import">Import JSON</button>
    </nav>
    <section class="tab-panel active" data-panel="blocks">
      <div class="gallery">
        ${blocks.map(renderBlockCard).join("")}
      </div>
    </section>
    <section class="tab-panel" data-panel="import">
      <div class="import-panel">
        <textarea class="json-input" data-json-input spellcheck="false" placeholder="Paste Html2FigmaDocument JSON"></textarea>
        <div class="import-actions">
          <input type="file" accept="application/json,.json" data-json-file>
          <button type="button" data-validate-json>Validate</button>
          <button type="button" data-render-json disabled>Render to Figma</button>
        </div>
        <pre class="json-summary" data-json-summary>No document loaded.</pre>
      </div>
    </section>
  </div>
`;
```

- [ ] **Step 2: Add tab and JSON import behavior**

In `example/figma-plugin/src/ui/main.ts`, import helpers:

```ts
import type { Html2FigmaDocument } from "html2figma";
import { parseDocumentJson, summarizeDocument } from "../shared/document";
```

Add state and handlers:

```ts
let importedDocument: Html2FigmaDocument | undefined;
let importedSource: "paste" | "file" = "paste";

function hydrateTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-tab]"));
  const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-panel]"));
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach((item) => item.classList.toggle("active", item === tab));
      panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === target));
    });
  }
}

function hydrateJsonImport(): void {
  const input = document.querySelector<HTMLTextAreaElement>("[data-json-input]");
  const file = document.querySelector<HTMLInputElement>("[data-json-file]");
  const validate = document.querySelector<HTMLButtonElement>("[data-validate-json]");
  const renderButton = document.querySelector<HTMLButtonElement>("[data-render-json]");
  const summary = document.querySelector<HTMLElement>("[data-json-summary]");
  if (!input || !file || !validate || !renderButton || !summary) return;

  validate.addEventListener("click", () => {
    loadJson(input.value, "paste", summary, renderButton);
  });

  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    loadJson(await selected.text(), "file", summary, renderButton);
  });

  renderButton.addEventListener("click", () => {
    if (!importedDocument) return;
    window.parent.postMessage({ pluginMessage: { type: "render-json", source: importedSource, document: importedDocument } }, "*");
  });
}

function loadJson(value: string, source: "paste" | "file", summary: HTMLElement, renderButton: HTMLButtonElement): void {
  try {
    importedDocument = parseDocumentJson(value);
    importedSource = source;
    const docSummary = summarizeDocument(importedDocument);
    summary.textContent = JSON.stringify(docSummary, null, 2);
    renderButton.disabled = false;
  } catch (error) {
    importedDocument = undefined;
    renderButton.disabled = true;
    summary.textContent = error instanceof Error ? error.message : "Invalid JSON document.";
  }
}
```

Call `hydrateTabs()` and `hydrateJsonImport()` after assigning `app.innerHTML`.

- [ ] **Step 3: Add tab and import styles**

Add to `example/figma-plugin/src/ui/styles.css`:

```css
.tabs {
  display: flex;
  gap: 8px;
  margin: 0 0 18px;
}

.tab {
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 10px;
  padding: 9px 12px;
  background: rgba(15, 23, 42, 0.72);
  color: rgb(226, 232, 240);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
}

.tab.active {
  background: rgb(56, 189, 248);
  color: rgb(8, 47, 73);
}

.tab-panel {
  display: none;
}

.tab-panel.active {
  display: block;
}

.import-panel {
  display: grid;
  gap: 12px;
  max-width: 920px;
}

.json-input {
  min-height: 260px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 14px;
  padding: 14px;
  background: rgb(2, 6, 23);
  color: rgb(226, 232, 240);
  font: 12px/18px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.import-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.json-summary {
  min-height: 120px;
  margin: 0;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 14px;
  padding: 14px;
  background: rgba(15, 23, 42, 0.72);
  color: rgb(203, 213, 225);
  white-space: pre-wrap;
}
```

- [ ] **Step 4: Handle render-json in plugin main**

Modify `example/figma-plugin/src/plugin/main.ts`:

```ts
const label =
  message.type === "render-block" ? message.blockId : `imported ${message.source} JSON`;

const result = await render(message.document, {
  parent: figma.currentPage,
  loadFonts: true
});

figma.currentPage.selection = [result.root];
figma.viewport.scrollAndZoomIntoView([result.root]);

const warningText =
  result.warnings.length === 0
    ? ""
    : ` with ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`;

figma.notify(`Rendered ${label}${warningText}`);
```

- [ ] **Step 5: Verify Figma plugin import UI**

Run:

```bash
cd example
npm run typecheck -w figma-plugin
npm run build -w figma-plugin
```

Expected: PASS.

- [ ] **Step 6: Commit import tab**

```bash
git add example/figma-plugin/src
git commit -m "feat(example): add Figma JSON import tab"
```

---

### Task 4: Chrome Extension Scaffold

**Files:**
- Create: `example/chrome-extension/package.json`
- Create: `example/chrome-extension/tsconfig.json`
- Create: `example/chrome-extension/vite.config.ts`
- Create: `example/chrome-extension/manifest.json`
- Create: `example/chrome-extension/src/shared/messages.ts`
- Create: `example/chrome-extension/src/shared/document.ts`
- Create: `example/chrome-extension/src/shared/document.test.ts`
- Create: `example/chrome-extension/src/background/main.ts`
- Create: `example/chrome-extension/src/content/main.ts`
- Create: `example/chrome-extension/src/popup/index.html`
- Create: `example/chrome-extension/src/popup/main.ts`
- Create: `example/chrome-extension/src/popup/styles.css`
- Create: `example/chrome-extension/src/viewer/index.html`
- Create: `example/chrome-extension/src/viewer/main.ts`
- Create: `example/chrome-extension/src/viewer/styles.css`

- [ ] **Step 1: Add Chrome extension package**

Create `example/chrome-extension/package.json`:

```json
{
  "name": "chrome-extension",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "html2figma": "file:../.."
  },
  "devDependencies": {
    "@types/chrome": "^0.0.306",
    "@types/node": "^25.6.2",
    "typescript": "^6.0.3",
    "vitest": "^3.1.3",
    "vite": "^8.0.11"
  }
}
```

Create `example/chrome-extension/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "lib": ["ES2022", "DOM"],
    "types": ["chrome", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `example/chrome-extension/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
```

- [ ] **Step 2: Add Vite multi-entry build**

Create `example/chrome-extension/vite.config.ts`:

```ts
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
        viewer: resolve(__dirname, "src/viewer/index.html"),
        background: resolve(__dirname, "src/background/main.ts"),
        content: resolve(__dirname, "src/content/main.ts")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
```

- [ ] **Step 3: Add Manifest V3**

Create `example/chrome-extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "html2figma Capture",
  "version": "0.1.0",
  "description": "Convert the current page or selected element into html2figma JSON.",
  "permissions": ["activeTab", "scripting", "downloads", "storage", "clipboardWrite"],
  "host_permissions": ["<all_urls>"],
  "action": {
    "default_popup": "src/popup/index.html"
  },
  "background": {
    "service_worker": "assets/background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["assets/content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 4: Add shared message and document helpers**

Create `example/chrome-extension/src/shared/messages.ts`:

```ts
import type { Html2FigmaDocument } from "html2figma";

export type CaptureTarget = "page" | "selection";

export interface StartSelectionMessage {
  type: "start-selection";
}

export interface CancelSelectionMessage {
  type: "cancel-selection";
}

export interface ConvertPageMessage {
  type: "convert-page";
}

export interface ConversionCompleteMessage {
  type: "conversion-complete";
  target: CaptureTarget;
  document: Html2FigmaDocument;
}

export interface GetLatestDocumentMessage {
  type: "get-latest-document";
}

export type ExtensionMessage =
  | StartSelectionMessage
  | CancelSelectionMessage
  | ConvertPageMessage
  | ConversionCompleteMessage
  | GetLatestDocumentMessage;
```

Create `example/chrome-extension/src/shared/document.ts`:

```ts
import type { Html2FigmaDocument, Html2FigmaNode } from "html2figma";

export interface DocumentSummary {
  rootName: string;
  rootType: string;
  nodeCount: number;
  resourceCount: number;
  warningCount: number;
  bounds: string;
}

export function summarizeDocument(document: Html2FigmaDocument): DocumentSummary {
  return {
    rootName: document.root.name,
    rootType: document.root.type,
    nodeCount: countNodes(document.root),
    resourceCount: document.resources.length,
    warningCount: document.warnings.length,
    bounds: `${Math.round(document.root.bounds.width)}x${Math.round(document.root.bounds.height)}`
  };
}

export function makeDownloadFilename(date = new Date()): string {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  return `html2figma-${stamp}.json`;
}

function countNodes(node: Html2FigmaNode): number {
  return 1 + node.children.reduce((total, child) => total + countNodes(child), 0);
}
```

- [ ] **Step 5: Add shared helper tests**

Create `example/chrome-extension/src/shared/document.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Html2FigmaDocument } from "html2figma";
import { makeDownloadFilename, summarizeDocument } from "./document";

const documentFixture: Html2FigmaDocument = {
  version: 1,
  root: {
    id: "node-1",
    type: "frame",
    name: "Selected Card",
    bounds: { x: 0, y: 0, width: 240, height: 120 },
    style: {},
    source: { tagName: "div", path: "html > body > div" },
    warnings: [],
    children: []
  },
  resources: [{ id: "resource-1", type: "image", source: "https://example.com/image.png" }],
  warnings: [],
  metadata: {
    viewport: { width: 1440, height: 900 },
    createdAt: "2026-05-11T00:00:00.000Z"
  }
};

describe("extension document helpers", () => {
  it("summarizes captured documents", () => {
    expect(summarizeDocument(documentFixture)).toEqual({
      rootName: "Selected Card",
      rootType: "frame",
      nodeCount: 1,
      resourceCount: 1,
      warningCount: 0,
      bounds: "240x120"
    });
  });

  it("creates stable download filenames", () => {
    expect(makeDownloadFilename(new Date("2026-05-11T10:20:30.000Z"))).toBe("html2figma-20260511-102030.json");
  });
});
```

- [ ] **Step 6: Add empty UI shells**

Create popup and viewer HTML/CSS/TS files with minimal valid modules:

```html
<div id="app"></div>
<script type="module" src="./main.ts"></script>
```

For `main.ts`, start with:

```ts
document.querySelector("#app")!.textContent = "html2figma Capture";
```

- [ ] **Step 7: Verify extension scaffold**

Run:

```bash
cd example
npm install
npm run typecheck -w chrome-extension
npm run test -w chrome-extension
npm run build -w chrome-extension
```

Expected: PASS.

- [ ] **Step 8: Commit extension scaffold**

```bash
git add example/package.json example/package-lock.json example/chrome-extension
git commit -m "feat(example): scaffold Chrome extension"
```

---

### Task 5: Chrome Extension Conversion Flow

**Files:**
- Modify: `example/chrome-extension/src/background/main.ts`
- Modify: `example/chrome-extension/src/content/main.ts`
- Modify: `example/chrome-extension/src/popup/main.ts`
- Modify: `example/chrome-extension/src/popup/styles.css`
- Modify: `example/chrome-extension/src/viewer/main.ts`
- Modify: `example/chrome-extension/src/viewer/styles.css`

- [ ] **Step 1: Implement content conversion and selection**

In `example/chrome-extension/src/content/main.ts`:

```ts
import { convert } from "html2figma/convert";
import type { ExtensionMessage } from "../shared/messages";

let active = false;
let hovered: HTMLElement | undefined;

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === "convert-page") {
    completeConversion(document.body, "page");
  }
  if (message.type === "start-selection") {
    startSelection();
  }
  if (message.type === "cancel-selection") {
    stopSelection();
  }
});

function startSelection(): void {
  if (active) return;
  active = true;
  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("mouseout", onMouseOut, true);
  document.addEventListener("click", onClick, true);
}

function stopSelection(): void {
  active = false;
  clearHover();
  document.removeEventListener("mouseover", onMouseOver, true);
  document.removeEventListener("mouseout", onMouseOut, true);
  document.removeEventListener("click", onClick, true);
}

function onMouseOver(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  clearHover();
  hovered = target;
  hovered.dataset.html2figmaPreviousOutline = hovered.style.outline;
  hovered.style.outline = "2px solid #38bdf8";
}

function onMouseOut(): void {
  clearHover();
}

function onClick(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  if (hovered) {
    completeConversion(hovered, "selection");
  }
  stopSelection();
}

function clearHover(): void {
  if (!hovered) return;
  hovered.style.outline = hovered.dataset.html2figmaPreviousOutline ?? "";
  delete hovered.dataset.html2figmaPreviousOutline;
  hovered = undefined;
}

function completeConversion(element: HTMLElement, target: "page" | "selection"): void {
  chrome.runtime.sendMessage({
    type: "conversion-complete",
    target,
    document: convert(element)
  });
}
```

- [ ] **Step 2: Store latest document in background**

In `example/chrome-extension/src/background/main.ts`:

```ts
import type { Html2FigmaDocument } from "html2figma";
import type { ExtensionMessage } from "../shared/messages";

let latestDocument: Html2FigmaDocument | undefined;

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "conversion-complete") {
    latestDocument = message.document;
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "get-latest-document") {
    sendResponse({ document: latestDocument });
    return true;
  }

  return false;
});
```

- [ ] **Step 3: Implement popup actions**

In `example/chrome-extension/src/popup/main.ts`, implement the popup shell:

```ts
import type { Html2FigmaDocument } from "html2figma";
import { makeDownloadFilename, summarizeDocument } from "../shared/document";
import type { ExtensionMessage } from "../shared/messages";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing #app");

app.innerHTML = `
  <main class="popup">
    <h1>html2figma Capture</h1>
    <p data-status>No capture yet.</p>
    <div class="actions">
      <button type="button" data-page>Convert full page</button>
      <button type="button" data-select>Select element</button>
      <button type="button" data-viewer>Open JSON</button>
      <button type="button" data-copy>Copy JSON</button>
      <button type="button" data-download>Download JSON</button>
    </div>
    <pre data-summary></pre>
  </main>
`;

const status = app.querySelector<HTMLElement>("[data-status]")!;
const summary = app.querySelector<HTMLElement>("[data-summary]")!;

app.querySelector<HTMLButtonElement>("[data-page]")!.addEventListener("click", () => sendToActiveTab({ type: "convert-page" }));
app.querySelector<HTMLButtonElement>("[data-select]")!.addEventListener("click", () => sendToActiveTab({ type: "start-selection" }));
app.querySelector<HTMLButtonElement>("[data-viewer]")!.addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("src/viewer/index.html") }));
app.querySelector<HTMLButtonElement>("[data-copy]")!.addEventListener("click", () => withLatestDocument(copyDocument));
app.querySelector<HTMLButtonElement>("[data-download]")!.addEventListener("click", () => withLatestDocument(downloadDocument));

void refreshSummary();

async function sendToActiveTab(message: ExtensionMessage): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    setStatus("No active tab.");
    return;
  }
  await chrome.tabs.sendMessage(tab.id, message);
  setStatus(message.type === "start-selection" ? "Click an element on the page." : "Conversion requested.");
  window.setTimeout(() => void refreshSummary(), 500);
}

async function withLatestDocument(action: (document: Html2FigmaDocument) => Promise<void>): Promise<void> {
  const document = await getLatestDocument();
  if (!document) {
    setStatus("No converted JSON available.");
    return;
  }
  await action(document);
  await refreshSummary();
}

async function getLatestDocument(): Promise<Html2FigmaDocument | undefined> {
  const response = await chrome.runtime.sendMessage({ type: "get-latest-document" });
  return response?.document;
}

async function refreshSummary(): Promise<void> {
  const document = await getLatestDocument();
  if (!document) return;
  summary.textContent = JSON.stringify(summarizeDocument(document), null, 2);
  setStatus("JSON ready.");
}

async function copyDocument(document: Html2FigmaDocument): Promise<void> {
  await navigator.clipboard.writeText(JSON.stringify(document, null, 2));
  setStatus("Copied JSON.");
}

async function downloadDocument(document: Html2FigmaDocument): Promise<void> {
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename: makeDownloadFilename(), saveAs: true });
  URL.revokeObjectURL(url);
  setStatus("Download started.");
}

function setStatus(message: string): void {
  status.textContent = message;
}
```

- [ ] **Step 4: Implement JSON viewer**

In `example/chrome-extension/src/viewer/main.ts`, implement the viewer page:

```ts
import type { Html2FigmaDocument } from "html2figma";
import { makeDownloadFilename, summarizeDocument } from "../shared/document";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing #app");

app.innerHTML = `
  <main class="viewer">
    <header>
      <h1>html2figma JSON</h1>
      <div class="actions">
        <button type="button" data-copy>Copy JSON</button>
        <button type="button" data-download>Download JSON</button>
      </div>
    </header>
    <pre data-summary></pre>
    <pre data-json></pre>
  </main>
`;

const summary = app.querySelector<HTMLElement>("[data-summary]")!;
const json = app.querySelector<HTMLElement>("[data-json]")!;
let currentDocument: Html2FigmaDocument | undefined;

void loadDocument();

app.querySelector<HTMLButtonElement>("[data-copy]")!.addEventListener("click", async () => {
  if (currentDocument) await navigator.clipboard.writeText(JSON.stringify(currentDocument, null, 2));
});

app.querySelector<HTMLButtonElement>("[data-download]")!.addEventListener("click", async () => {
  if (!currentDocument) return;
  const blob = new Blob([JSON.stringify(currentDocument, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename: makeDownloadFilename(), saveAs: true });
  URL.revokeObjectURL(url);
});

async function loadDocument(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: "get-latest-document" });
  currentDocument = response?.document;
  if (!currentDocument) {
    summary.textContent = "No converted document available.";
    json.textContent = "";
    return;
  }
  summary.textContent = JSON.stringify(summarizeDocument(currentDocument), null, 2);
  json.textContent = JSON.stringify(currentDocument, null, 2);
}
```

- [ ] **Step 5: Verify conversion flow build**

Run:

```bash
cd example
npm run typecheck -w chrome-extension
npm run test -w chrome-extension
npm run build -w chrome-extension
```

Expected: PASS.

- [ ] **Step 6: Commit conversion flow**

```bash
git add example/chrome-extension/src
git commit -m "feat(example): add Chrome page capture flow"
```

---

### Task 6: Example Documentation and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `example/package.json`
- Modify: `example/figma-plugin/package.json`
- Modify: `example/chrome-extension/package.json`

- [ ] **Step 1: Update README example section**

Add an `Examples` section to `README.md`:

````md
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
npm run build -w chrome-extension
```

Load `example/chrome-extension/dist` through Chrome's Load unpacked flow.
````

- [ ] **Step 2: Run final example verification**

Run:

```bash
cd example
npm run typecheck
npm test --workspaces --if-present
npm run build
```

Expected: both workspace apps typecheck, helper tests pass, and both apps build.

- [ ] **Step 3: Run root verification**

Run:

```bash
npm run verify
npm run test:browser
```

Expected: root library checks continue to pass.

- [ ] **Step 4: Commit documentation and final adjustments**

```bash
git add README.md example
git commit -m "docs(example): document extension import workflow"
```

---

## Plan Self-Review

- Spec coverage: The plan covers the workspace split, existing Figma gallery preservation, `Import JSON` tab, paste/upload JSON support, Chrome extension full-page conversion, single-element visual selection, JSON viewer, copy/download, scripts, tests, and documentation.
- Completeness scan: The plan contains explicit file paths, commands, message shapes, helper APIs, and commit points.
- Type consistency: Message names match the spec: `render-json`, `render-block`, `conversion-complete`, `convert-page`, `start-selection`, and `get-latest-document`.
