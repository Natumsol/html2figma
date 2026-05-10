# html2figma Example Plugin Design

## Status

Approved design direction from brainstorming. This spec defines an `example/` directory that demonstrates a Figma plugin using `html2figma` with a local iframe UI devserver, `postMessage` communication, HTML block previews, and one-click rendering into the current Figma canvas.

## Goals

- Provide a self-contained example project under `example/`.
- Let users run the demo with `cd example && npm install && npm run dev`.
- Host the plugin UI from a configurable local devserver URL.
- Display multiple HTML-authored demo blocks in a masonry card gallery.
- Render one selected card's preview DOM into the current Figma page.
- Demonstrate the intended runtime split:
  - UI iframe calls `convert()` in a browser context.
  - Figma plugin main calls `render()` in the Figma plugin context.
  - The boundary between them is a serializable `Html2FigmaDocument`.

## Non-Goals

- Multi-select or batch rendering in the first example.
- Production packaging for a remote hosted UI.
- Figma e2e automation.
- Screenshot fallback rendering.
- A framework-based UI.
- Expanding the library's CSS support as part of the example.

## Project Shape

The example is an independent package:

```text
example/
  package.json
  tsconfig.json
  example.config.ts
  index.html
  manifest.json
  vite.ui.config.ts
  vite.plugin.config.ts
  blocks/
    hero-section.html
    pricing-card.html
    stats-panel.html
  scripts/
    sync-manifest.ts
  src/
    messages.ts
    plugin/
      main.ts
      ui-shell.ts
    ui/
      blocks.ts
      main.ts
      styles.css
```

`example/package.json` depends on `html2figma` through `file:..` so the demo behaves like a real package consumer while still using the local repository.

## Runtime Architecture

Figma plugin main cannot directly load a remote URL through `figma.showUI()`. The plugin main will call `figma.showUI()` with a small inline HTML shell. That shell contains a full-size iframe whose `src` is the configured local UI devserver URL.

```text
Figma plugin main
  -> figma.showUI(inline iframe shell)
  -> listens with figma.ui.onmessage

Local iframe UI
  -> loads /blocks/*.html from Vite devserver
  -> renders masonry preview cards
  -> calls convert(previewElement) on button click
  -> sends { type: "render-block", blockId, document } to the inline shell

Inline shell
  -> validates the iframe origin
  -> forwards { pluginMessage } to the Figma host with parent.postMessage

Figma plugin main
  -> validates message type
  -> render(document, { parent: figma.currentPage, loadFonts: true })
  -> selects root node
  -> scrolls and zooms into created root
  -> notifies success or failure
```

The inline shell is intentionally tiny. It owns only iframe creation and message forwarding. The real UI code remains in the local devserver so users can edit UI and block HTML without rebuilding the Figma plugin main for every visual change.

## Configuration

`example.config.ts` is the single source for demo settings:

```ts
export default {
  pluginName: "html2figma Example",
  pluginId: "html2figma-example",
  uiDevUrl: "http://127.0.0.1:5173",
  uiWidth: 960,
  uiHeight: 720
};
```

`scripts/sync-manifest.ts` reads this config and writes `manifest.json`. The manifest points `main` at the built plugin bundle, uses dynamic document access, and grants development-only network access to the configured devserver origin.

Generated manifest shape:

```json
{
  "name": "html2figma Example",
  "id": "html2figma-example",
  "api": "1.0.0",
  "main": "dist/plugin/main.js",
  "documentAccess": "dynamic-page",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["none"],
    "devAllowedDomains": ["http://127.0.0.1:5173"]
  }
}
```

The script derives the development allowed domain from `uiDevUrl` so users can change ports without editing two files.

## UI Design

The UI is plain TypeScript and DOM APIs. No React, Vue, or component framework is added.

`src/ui/blocks.ts` exports block metadata. Vite serves the `blocks/` public directory at the web root, so each block path is root-relative:

```ts
export const blocks = [
  {
    id: "hero-section",
    title: "Hero Section",
    path: "/hero-section.html"
  }
];
```

Each `blocks/*.html` file is an HTML fragment that can include local `<style>` tags. The UI fetches the fragments, injects each into a preview container, and renders cards in a CSS masonry layout:

```css
.gallery {
  columns: 280px;
  column-gap: 16px;
}

.card {
  break-inside: avoid;
  margin-bottom: 16px;
}
```

Each card includes:

- title
- rendered HTML preview
- render button
- lightweight status text for loading, rendering, and errors

Clicking a card's render button converts only that card's preview DOM.

## Messaging Contract

Shared message types live in `example/src/messages.ts`:

```ts
import type { Html2FigmaDocument } from "html2figma";

export interface RenderBlockMessage {
  type: "render-block";
  blockId: string;
  document: Html2FigmaDocument;
}

export type UiToPluginMessage = RenderBlockMessage;
```

The iframe UI sends messages to the inline shell using Figma's expected wrapper:

```ts
parent.postMessage(
  {
    pluginMessage: {
      type: "render-block",
      blockId,
      document
    }
  },
  "*"
);
```

The inline shell forwards that wrapper to the Figma host with `parent.postMessage(event.data, "*")`. The plugin main receives the unwrapped payload through `figma.ui.onmessage`.

## Plugin Main Behavior

`src/plugin/main.ts`:

- imports `render` from `html2figma/render`
- imports config and creates the iframe shell
- calls `figma.showUI(shellHtml, { width, height })`
- handles `render-block`
- renders into `figma.currentPage`
- selects `result.root`
- calls `figma.viewport.scrollAndZoomIntoView([result.root])`
- reports warning counts through `figma.notify()`

Render failures are caught and reported with `figma.notify("Failed to render block")`. Detailed errors are logged with `console.error()` for plugin developer debugging.

## Scripts

`example/package.json` provides:

```json
{
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

The root project can later add `example:verify` if desired, but the example remains independently runnable.

## Error Handling

The UI handles:

- failed block fetches by showing a card-level error
- failed conversion by keeping the card visible and displaying the error text
- repeated clicks by disabling the clicked render button while conversion is running

The plugin main handles:

- unknown message types by ignoring them
- render failures by logging and notifying
- successful render warnings by notifying with the warning count

The example does not attempt to recover from a missing UI devserver. Users will see the iframe browser error, which is acceptable for a local development demo.

## Testing And Verification

The example uses build-time verification rather than live Figma automation:

- `npm run typecheck` validates UI, plugin, config, script, and message types.
- `npm run build` verifies manifest generation plus UI and plugin bundles.

Manual smoke test:

1. `cd example`
2. `npm install`
3. `npm run dev`
4. import `example/manifest.json` into Figma as a development plugin
5. run the plugin
6. click Render on one card
7. confirm an editable Figma layer tree appears on the current page

## Success Criteria

- A user can install and run the example independently from the root project.
- The UI appears inside the Figma plugin through an iframe served by the local devserver.
- The UI displays HTML fragments as masonry cards.
- Clicking one card converts that card's rendered DOM and sends the AST to plugin main.
- Plugin main renders the AST onto the current Figma canvas and selects the created root node.
- The example clearly demonstrates `convert()` in the browser runtime and `render()` in the Figma runtime.
