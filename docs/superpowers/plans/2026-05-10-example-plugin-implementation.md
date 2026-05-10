# html2figma Example Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent `example/` Figma plugin demo that loads a local iframe UI devserver, displays HTML fragment cards, converts one selected card with `convert()`, and renders it into Figma with `render()`.

**Architecture:** The example is its own npm package and consumes the root library via `file:..`. The UI runs in a Vite-served iframe and owns DOM conversion; the plugin main runs in the Figma runtime and owns rendering. A tiny inline shell hosts the iframe and forwards typed `UiToPluginMessage` payloads to Figma so the serializable `Html2FigmaDocument` crosses the runtime boundary safely.

**Tech Stack:** TypeScript, Vite, Figma Plugin API, `html2figma`, `tsx`, `concurrently`, npm.

---

## File Structure

- Create `example/package.json`: independent example package, scripts, and local package dependency.
- Create `example/tsconfig.json`: strict TS config for UI, plugin, config, and scripts.
- Create `example/example.config.ts`: single source for plugin name, ID, iframe URL, and UI size.
- Create `example/vite.ui.config.ts`: browser UI Vite config.
- Create `example/vite.plugin.config.ts`: plugin main Vite library build config.
- Create `example/index.html`: Vite UI HTML entry.
- Create `example/scripts/sync-manifest.ts`: generate `manifest.json` from config.
- Create `example/manifest.json`: generated development manifest committed for easy import.
- Create `example/src/messages.ts`: shared `UiToPluginMessage` types and runtime type guard.
- Create `example/src/plugin/ui-shell.ts`: inline shell HTML with iframe.
- Create `example/src/plugin/main.ts`: Figma plugin runtime and render message handler.
- Create `example/src/ui/blocks.ts`: block metadata.
- Create `example/src/ui/main.ts`: fetch fragments, render masonry cards, convert selected card, send message.
- Create `example/src/ui/styles.css`: example UI and masonry styling.
- Create `example/blocks/hero-section.html`: demo HTML block served by Vite at `/hero-section.html`.
- Create `example/blocks/pricing-card.html`: demo HTML block served by Vite at `/pricing-card.html`.
- Create `example/blocks/stats-panel.html`: demo HTML block served by Vite at `/stats-panel.html`.
- Modify `package.json`: add root `example:verify` helper.

---

### Task 1: Example Package Scaffold

**Files:**
- Create: `example/package.json`
- Create: `example/tsconfig.json`
- Create: `example/example.config.ts`
- Create: `example/vite.ui.config.ts`
- Create: `example/vite.plugin.config.ts`
- Create: `example/index.html`

- [ ] **Step 1: Create `example/package.json`**

```json
{
  "name": "html2figma-example",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run dev:ui\" \"npm run dev:plugin\"",
    "dev:ui": "vite --config vite.ui.config.ts --host 127.0.0.1 --port 5173",
    "dev:plugin": "npm run sync-manifest && vite build --config vite.plugin.config.ts --watch",
    "build": "npm run sync-manifest && vite build --config vite.ui.config.ts && vite build --config vite.plugin.config.ts",
    "sync-manifest": "tsx scripts/sync-manifest.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Create `example/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM"],
    "types": ["@figma/plugin-typings", "vite/client", "node"],
    "noEmit": true
  },
  "include": [
    "example.config.ts",
    "vite.ui.config.ts",
    "vite.plugin.config.ts",
    "scripts/**/*.ts",
    "src/**/*.ts"
  ],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: Create `example/example.config.ts`**

```ts
const exampleConfig = {
  pluginName: "html2figma Example",
  pluginId: "html2figma-example",
  uiDevUrl: "http://localhost:5173",
  uiWidth: 960,
  uiHeight: 720
} as const;

export default exampleConfig;
```

- [ ] **Step 4: Create `example/vite.ui.config.ts`**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "blocks",
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: "dist/ui",
    emptyOutDir: false
  }
});
```

- [ ] **Step 5: Create `example/vite.plugin.config.ts`**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/plugin",
    emptyOutDir: false,
    lib: {
      entry: "src/plugin/main.ts",
      formats: ["es"],
      fileName: () => "main.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    },
    target: "es2017"
  }
});
```

- [ ] **Step 6: Create `example/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>html2figma Example</title>
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="/src/ui/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Install example dependencies**

Run:

```bash
cd example
npm install html2figma@file:..
npm install --save-dev @figma/plugin-typings vite typescript tsx concurrently
npm install --save-dev @types/node
npm install
```

Expected: `example/package-lock.json` is created and dependencies install successfully.

- [ ] **Step 8: Run typecheck to verify the scaffold fails on missing source files**

Run:

```bash
npm run typecheck
```

Expected: PASS. The scaffold has no UI or plugin source yet, but the TypeScript config and Vite config files compile.

- [ ] **Step 9: Commit scaffold**

```bash
git add example/package.json example/package-lock.json example/tsconfig.json example/example.config.ts example/vite.ui.config.ts example/vite.plugin.config.ts example/index.html
git commit -m "chore: scaffold example plugin package"
```

---

### Task 2: Manifest Generation And Shared Message Types

**Files:**
- Create: `example/scripts/sync-manifest.ts`
- Create: `example/manifest.json`
- Create: `example/src/messages.ts`

- [ ] **Step 1: Create `example/scripts/sync-manifest.ts`**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import exampleConfig from "../example.config";

const currentDir = dirname(fileURLToPath(import.meta.url));
const exampleRoot = resolve(currentDir, "..");
const manifestPath = resolve(exampleRoot, "manifest.json");

interface FigmaManifest {
  name: string;
  id: string;
  api: "1.0.0";
  main: string;
  documentAccess: "dynamic-page";
  editorType: ["figma"];
  networkAccess: {
    allowedDomains: ["none"];
    devAllowedDomains: string[];
  };
}

async function main(): Promise<void> {
  const manifest: FigmaManifest = {
    name: exampleConfig.pluginName,
    id: exampleConfig.pluginId,
    api: "1.0.0",
    main: "dist/plugin/main.js",
    documentAccess: "dynamic-page",
    editorType: ["figma"],
    networkAccess: {
      allowedDomains: ["none"],
      devAllowedDomains: [new URL(exampleConfig.uiDevUrl).origin]
    }
  };

  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Create `example/src/messages.ts`**

```ts
import type { Html2FigmaDocument } from "html2figma";

export interface RenderBlockMessage {
  type: "render-block";
  blockId: string;
  document: Html2FigmaDocument;
}

export type UiToPluginMessage = RenderBlockMessage;

export function isUiToPluginMessage(value: unknown): value is UiToPluginMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<UiToPluginMessage>;
  return (
    message.type === "render-block" &&
    typeof message.blockId === "string" &&
    Boolean(message.document)
  );
}
```

- [ ] **Step 3: Generate `example/manifest.json`**

Run:

```bash
cd example
npm run sync-manifest
```

Expected: PASS and `example/manifest.json` contains `documentAccess`, `allowedDomains: ["none"]`, and `devAllowedDomains: ["http://localhost:5173"]`.

- [ ] **Step 4: Commit manifest and messages**

```bash
git add example/scripts/sync-manifest.ts example/src/messages.ts example/manifest.json
git commit -m "feat: generate example plugin manifest"
```

---

### Task 3: Plugin Main Runtime

**Files:**
- Create: `example/src/plugin/ui-shell.ts`
- Create: `example/src/plugin/main.ts`

- [ ] **Step 1: Create `example/src/plugin/ui-shell.ts`**

```ts
export function createUiShellHtml(uiDevUrl: string): string {
  const iframeUrl = escapeHtml(uiDevUrl);
  const iframeOriginJson = JSON.stringify(new URL(uiDevUrl).origin);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <style>
      html,
      body,
      iframe {
        width: 100%;
        height: 100%;
        margin: 0;
        border: 0;
        overflow: hidden;
      }

      body {
        background: #0f172a;
      }
    </style>
  </head>
  <body>
    <iframe src="${iframeUrl}" title="html2figma example UI"></iframe>
    <script>
      const allowedOrigin = ${iframeOriginJson};
      window.addEventListener("message", (event) => {
        if (event.origin !== allowedOrigin) {
          return;
        }

        if (!event.data || typeof event.data !== "object" || !("pluginMessage" in event.data)) {
          return;
        }

        parent.postMessage(event.data, "*");
      });
    </script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
```

- [ ] **Step 2: Create `example/src/plugin/main.ts`**

```ts
import { render } from "html2figma/render";
import exampleConfig from "../../example.config";
import { isUiToPluginMessage } from "../messages";
import { createUiShellHtml } from "./ui-shell";

figma.showUI(createUiShellHtml(exampleConfig.uiDevUrl), {
  width: exampleConfig.uiWidth,
  height: exampleConfig.uiHeight
});

figma.ui.onmessage = async (message: unknown) => {
  if (!isUiToPluginMessage(message)) {
    return;
  }

  try {
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

    figma.notify(`Rendered ${message.blockId}${warningText}`);
  } catch (error) {
    console.error("Failed to render html2figma block", error);
    figma.notify(`Failed to render ${message.blockId}`);
  }
};
```

- [ ] **Step 3: Run typecheck for plugin runtime**

Run:

```bash
cd example
npm run typecheck
```

Expected: PASS. The plugin main, shell, and shared message files compile before the UI runtime is added.

- [ ] **Step 4: Commit plugin main runtime**

```bash
git add example/src/plugin/ui-shell.ts example/src/plugin/main.ts
git commit -m "feat: add example plugin main runtime"
```

---

### Task 4: HTML Block Gallery Source

**Files:**
- Create: `example/src/ui/blocks.ts`
- Create: `example/blocks/hero-section.html`
- Create: `example/blocks/pricing-card.html`
- Create: `example/blocks/stats-panel.html`

- [ ] **Step 1: Create `example/src/ui/blocks.ts`**

```ts
export interface ExampleBlock {
  id: string;
  title: string;
  description: string;
  path: string;
}

export const blocks: ExampleBlock[] = [
  {
    id: "hero-section",
    title: "Hero Section",
    description: "A compact marketing hero with gradient background and call to action.",
    path: "/hero-section.html"
  },
  {
    id: "pricing-card",
    title: "Pricing Card",
    description: "A subscription card with badges, feature rows, and a CTA button.",
    path: "/pricing-card.html"
  },
  {
    id: "stats-panel",
    title: "Stats Panel",
    description: "A dashboard-style KPI block with multiple metric tiles.",
    path: "/stats-panel.html"
  }
];
```

- [ ] **Step 2: Create `example/blocks/hero-section.html`**

```html
<section class="h2f-hero">
  <style>
    .h2f-hero {
      box-sizing: border-box;
      width: 560px;
      padding: 40px;
      border-radius: 28px;
      background: rgb(22, 32, 78);
      color: rgb(255, 255, 255);
      font-family: Inter, Arial, sans-serif;
      box-shadow: rgba(15, 23, 42, 0.28) 0px 20px 48px 0px;
    }

    .h2f-hero-eyebrow {
      margin: 0 0 14px;
      color: rgb(125, 211, 252);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.6px;
      text-transform: uppercase;
    }

    .h2f-hero-title {
      margin: 0;
      max-width: 440px;
      font-size: 44px;
      line-height: 50px;
      font-weight: 800;
    }

    .h2f-hero-copy {
      margin: 18px 0 28px;
      max-width: 420px;
      color: rgb(203, 213, 225);
      font-size: 17px;
      line-height: 28px;
    }

    .h2f-hero-button {
      display: inline-block;
      padding: 13px 18px;
      border-radius: 999px;
      background: rgb(56, 189, 248);
      color: rgb(8, 47, 73);
      font-size: 15px;
      font-weight: 800;
    }
  </style>
  <p class="h2f-hero-eyebrow">Design to canvas</p>
  <h1 class="h2f-hero-title">Turn HTML sections into editable Figma layers.</h1>
  <p class="h2f-hero-copy">Convert real browser DOM, preserve common styles, then render the result inside a Figma plugin.</p>
  <div class="h2f-hero-button">Render this hero</div>
</section>
```

- [ ] **Step 3: Create `example/blocks/pricing-card.html`**

```html
<section class="h2f-pricing">
  <style>
    .h2f-pricing {
      box-sizing: border-box;
      width: 340px;
      padding: 28px;
      border: 1px solid rgb(226, 232, 240);
      border-radius: 24px;
      background: rgb(255, 255, 255);
      color: rgb(15, 23, 42);
      font-family: Inter, Arial, sans-serif;
      box-shadow: rgba(15, 23, 42, 0.12) 0px 18px 42px 0px;
    }

    .h2f-pricing-badge {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgb(219, 234, 254);
      color: rgb(30, 64, 175);
      font-size: 12px;
      font-weight: 800;
    }

    .h2f-pricing-title {
      margin: 18px 0 8px;
      font-size: 24px;
      line-height: 32px;
      font-weight: 800;
    }

    .h2f-pricing-price {
      margin: 0 0 18px;
      font-size: 42px;
      line-height: 46px;
      font-weight: 900;
    }

    .h2f-pricing-price span {
      color: rgb(100, 116, 139);
      font-size: 15px;
      font-weight: 600;
    }

    .h2f-pricing-feature {
      margin: 10px 0;
      color: rgb(51, 65, 85);
      font-size: 15px;
      line-height: 22px;
    }

    .h2f-pricing-button {
      margin-top: 22px;
      padding: 13px 16px;
      border-radius: 14px;
      background: rgb(15, 23, 42);
      color: rgb(255, 255, 255);
      text-align: center;
      font-size: 15px;
      font-weight: 800;
    }
  </style>
  <div class="h2f-pricing-badge">Popular</div>
  <h2 class="h2f-pricing-title">Studio</h2>
  <p class="h2f-pricing-price">$29 <span>/ month</span></p>
  <p class="h2f-pricing-feature">Unlimited HTML block conversions</p>
  <p class="h2f-pricing-feature">Editable Figma layer output</p>
  <p class="h2f-pricing-feature">Structured conversion warnings</p>
  <div class="h2f-pricing-button">Start rendering</div>
</section>
```

- [ ] **Step 4: Create `example/blocks/stats-panel.html`**

```html
<section class="h2f-stats">
  <style>
    .h2f-stats {
      box-sizing: border-box;
      width: 460px;
      padding: 26px;
      border-radius: 26px;
      background: rgb(248, 250, 252);
      color: rgb(15, 23, 42);
      font-family: Inter, Arial, sans-serif;
      border: 1px solid rgb(226, 232, 240);
    }

    .h2f-stats-title {
      margin: 0 0 18px;
      font-size: 22px;
      line-height: 30px;
      font-weight: 850;
    }

    .h2f-stats-grid {
      display: flex;
      gap: 12px;
    }

    .h2f-stat {
      box-sizing: border-box;
      width: 128px;
      padding: 16px;
      border-radius: 18px;
      background: rgb(255, 255, 255);
      border: 1px solid rgb(226, 232, 240);
    }

    .h2f-stat-value {
      margin: 0;
      color: rgb(37, 99, 235);
      font-size: 28px;
      line-height: 34px;
      font-weight: 900;
    }

    .h2f-stat-label {
      margin: 6px 0 0;
      color: rgb(100, 116, 139);
      font-size: 13px;
      line-height: 18px;
      font-weight: 700;
    }
  </style>
  <h2 class="h2f-stats-title">Conversion Snapshot</h2>
  <div class="h2f-stats-grid">
    <div class="h2f-stat">
      <p class="h2f-stat-value">32</p>
      <p class="h2f-stat-label">nodes</p>
    </div>
    <div class="h2f-stat">
      <p class="h2f-stat-value">8</p>
      <p class="h2f-stat-label">styles</p>
    </div>
    <div class="h2f-stat">
      <p class="h2f-stat-value">0</p>
      <p class="h2f-stat-label">errors</p>
    </div>
  </div>
</section>
```

- [ ] **Step 5: Commit gallery source files**

```bash
git add example/src/ui/blocks.ts example/blocks/hero-section.html example/blocks/pricing-card.html example/blocks/stats-panel.html
git commit -m "feat: add example HTML block gallery"
```

---

### Task 5: Iframe UI Runtime

**Files:**
- Create: `example/src/ui/main.ts`
- Create: `example/src/ui/styles.css`

- [ ] **Step 1: Create `example/src/ui/styles.css`**

```css
:root {
  color: rgb(226, 232, 240);
  background: rgb(15, 23, 42);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.24), transparent 34rem),
    rgb(15, 23, 42);
}

.app {
  min-height: 100vh;
  padding: 28px;
}

.header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 8px;
  color: rgb(125, 211, 252);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: rgb(248, 250, 252);
  font-size: 32px;
  line-height: 38px;
}

.subtitle {
  margin: 8px 0 0;
  max-width: 620px;
  color: rgb(148, 163, 184);
  font-size: 14px;
  line-height: 22px;
}

.gallery {
  columns: 300px;
  column-gap: 18px;
}

.card {
  display: inline-block;
  width: 100%;
  margin: 0 0 18px;
  overflow: hidden;
  break-inside: avoid;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 22px;
  background: rgba(15, 23, 42, 0.72);
  box-shadow: rgba(0, 0, 0, 0.28) 0 18px 40px;
}

.preview {
  overflow: auto;
  padding: 18px;
  background:
    linear-gradient(45deg, rgba(148, 163, 184, 0.08) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148, 163, 184, 0.08) 25%, transparent 25%),
    rgb(241, 245, 249);
  background-size: 22px 22px;
}

.preview-inner {
  width: max-content;
  min-width: 100%;
  transform-origin: top left;
}

.card-body {
  padding: 16px;
}

.card h2 {
  margin: 0;
  color: rgb(248, 250, 252);
  font-size: 17px;
  line-height: 24px;
}

.card p {
  margin: 6px 0 14px;
  color: rgb(148, 163, 184);
  font-size: 13px;
  line-height: 20px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

button {
  border: 0;
  border-radius: 12px;
  padding: 10px 12px;
  background: rgb(56, 189, 248);
  color: rgb(8, 47, 73);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
}

button:disabled {
  cursor: wait;
  opacity: 0.62;
}

.status {
  min-height: 18px;
  color: rgb(148, 163, 184);
  font-size: 12px;
  line-height: 18px;
}

.status.error {
  color: rgb(248, 113, 113);
}
```

- [ ] **Step 2: Create `example/src/ui/main.ts`**

```ts
import { convert } from "html2figma/convert";
import { blocks, type ExampleBlock } from "./blocks";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("Missing #app mount node");
}

app.className = "app";
app.innerHTML = `
  <header class="header">
    <div>
      <p class="eyebrow">html2figma example</p>
      <h1>Render HTML blocks into Figma</h1>
      <p class="subtitle">Each card is a real HTML fragment loaded from the local Vite devserver. Click Render to convert that card's DOM and send the AST to the plugin main thread.</p>
    </div>
  </header>
  <section class="gallery" aria-label="HTML block gallery"></section>
`;

const gallery = app.querySelector<HTMLElement>(".gallery");

if (!gallery) {
  throw new Error("Missing gallery node");
}

void renderGallery(gallery);

async function renderGallery(target: HTMLElement): Promise<void> {
  const cards = await Promise.all(blocks.map(loadBlockCard));
  target.replaceChildren(...cards);
}

async function loadBlockCard(block: ExampleBlock): Promise<HTMLElement> {
  const card = document.createElement("article");
  card.className = "card";

  const preview = document.createElement("div");
  preview.className = "preview";

  const previewInner = document.createElement("div");
  previewInner.className = "preview-inner";
  preview.append(previewInner);

  const body = document.createElement("div");
  body.className = "card-body";
  body.innerHTML = `
    <h2>${escapeHtml(block.title)}</h2>
    <p>${escapeHtml(block.description)}</p>
  `;

  const actions = document.createElement("div");
  actions.className = "actions";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Render to Figma";

  const status = document.createElement("span");
  status.className = "status";

  actions.append(button, status);
  body.append(actions);
  card.append(preview, body);

  try {
    previewInner.innerHTML = await fetchBlockHtml(block.path);
  } catch (error) {
    status.className = "status error";
    status.textContent = error instanceof Error ? error.message : "Failed to load block";
    button.disabled = true;
  }

  button.addEventListener("click", () => {
    renderBlock(block, previewInner, button, status);
  });

  return card;
}

async function fetchBlockHtml(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  return response.text();
}

function renderBlock(
  block: ExampleBlock,
  previewElement: HTMLElement,
  button: HTMLButtonElement,
  status: HTMLElement
): void {
  button.disabled = true;
  status.className = "status";
  status.textContent = "Converting...";

  try {
    const documentAst = convert(previewElement);
    parent.postMessage(
      {
        pluginMessage: {
          type: "render-block",
          blockId: block.id,
          document: documentAst
        }
      },
      "*"
    );
    status.textContent = "Sent to Figma";
  } catch (error) {
    status.className = "status error";
    status.textContent = error instanceof Error ? error.message : "Conversion failed";
  } finally {
    button.disabled = false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
cd example
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run full example build**

Run:

```bash
npm run build
```

Expected: PASS. Vite builds `dist/ui` and `dist/plugin/main.js`.

- [ ] **Step 5: Commit UI runtime**

```bash
git add example/src/ui/main.ts example/src/ui/styles.css
git commit -m "feat: add example iframe UI"
```

---

### Task 6: Root Verification Script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Modify root `package.json` scripts**

Replace the `scripts` object with:

```json
"scripts": {
  "build": "tsup",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:browser": "playwright test",
  "verify": "npm run typecheck && npm run test && npm run build",
  "example:verify": "npm --prefix example install && npm --prefix example run typecheck && npm --prefix example run build"
}
```

- [ ] **Step 2: Run root package typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run example verification from root**

Run:

```bash
npm run example:verify
```

Expected: PASS. npm installs `example` dependencies if needed, then typechecks and builds the example.

- [ ] **Step 4: Commit verification script**

```bash
git add package.json example/package-lock.json
git commit -m "chore: add example verification script"
```

---

### Task 7: Final Verification And Smoke Instructions

**Files:**
- Read: `docs/superpowers/specs/2026-05-10-example-plugin-design.md`
- Read: `docs/superpowers/plans/2026-05-10-example-plugin-implementation.md`
- Read: `example/manifest.json`
- Read: `example/src/plugin/main.ts`
- Read: `example/src/ui/main.ts`

- [ ] **Step 1: Confirm spec coverage**

Run:

```bash
rg -n "self-contained|uiDevUrl|masonry|render-block|documentAccess|devAllowedDomains|convert\\(|render\\(" docs/superpowers/specs/2026-05-10-example-plugin-design.md docs/superpowers/plans/2026-05-10-example-plugin-implementation.md example
```

Expected: output references the spec, plan, config, manifest, UI conversion, message contract, and plugin render handler.

- [ ] **Step 2: Run repository verification**

Run:

```bash
npm run verify
```

Expected: PASS for root typecheck, unit tests, and build.

- [ ] **Step 3: Run browser conversion tests**

Run:

```bash
npm run test:browser
```

Expected: PASS.

- [ ] **Step 4: Run example verification**

Run:

```bash
npm run example:verify
```

Expected: PASS.

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short
```

Expected: no uncommitted changes after task commits, except ignored generated files.

- [ ] **Step 6: Manual Figma smoke test**

Run:

```bash
cd example
npm run dev
```

Expected: UI devserver starts on `http://localhost:5173` and plugin main watch build writes `dist/plugin/main.js`.

Then in Figma:

1. Import `example/manifest.json` as a development plugin.
2. Run `html2figma Example`.
3. Confirm the iframe UI displays the masonry gallery.
4. Click `Render to Figma` on one card.
5. Confirm Figma creates editable layers on the current page and selects the root node.

---

## Plan Self-Review

- Spec coverage: The plan covers the independent `example/` package, configurable iframe devserver URL, generated manifest, dynamic document access, `devAllowedDomains`, HTML fragment gallery served from root URLs by Vite's `blocks` public directory, single-card conversion, typed `postMessage`, plugin main rendering, build verification, and manual Figma smoke test.
- Placeholder scan: The plan contains no placeholder terms, unspecified error handling, or missing code steps.
- Scope check: The plan implements one cohesive example project. It does not include multi-select, remote UI packaging, Figma e2e automation, screenshot fallback, framework UI, or extra library CSS support.
- Type consistency: `UiToPluginMessage`, `RenderBlockMessage`, `isUiToPluginMessage`, `blockId`, `document`, `createUiShellHtml`, `exampleConfig.uiDevUrl`, `convert()`, and `render()` are named consistently across tasks.
