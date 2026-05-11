# Example Chrome Extension and Figma JSON Import Design

## Status

Approved design direction from brainstorming. This spec defines a refactor of `example/` into two example applications:

- a Chrome extension that converts the current webpage or a selected element into an `Html2FigmaDocument` JSON payload
- a Figma plugin that can render built-in demo blocks and import JSON exported by the Chrome extension

## Goals

- Split `example/` into two independent example apps:
  - `example/chrome-extension/`
  - `example/figma-plugin/`
- Preserve the existing Figma block gallery demo.
- Add a Chrome extension that can:
  - convert the full page
  - visually select one DOM element on the current page
  - convert the selected element to AST JSON
  - show conversion summary
  - open a full JSON viewer
  - copy JSON to clipboard
  - download JSON locally
- Add a Figma plugin `Import JSON` tab that can:
  - paste JSON
  - upload a local `.json` file
  - validate a first-version `Html2FigmaDocument`
  - render valid JSON into Figma layers with `render()`

## Non-Goals

- Chrome Web Store packaging.
- Figma plugin publishing workflow.
- Direct communication from Chrome extension to Figma.
- Drag-box multi-element selection.
- Full JSON Schema validation.
- Expanding core library CSS support as part of the example.

## Project Structure

The example directory becomes a small workspace:

```text
example/
  package.json
  chrome-extension/
    manifest.json
    package.json
    src/
      background/
      content/
      popup/
      viewer/
      shared/
  figma-plugin/
    manifest.json
    package.json
    src/
      plugin/
      ui/
      shared/
```

Both apps depend on the local library with `html2figma: "file:../.."`. They do not depend on each other. The AST JSON is exchanged through clipboard or downloaded files.

## Chrome Extension Design

The Chrome extension uses Manifest V3.

### Components

- `background` service worker:
  - coordinates messages between popup, content script, and viewer page
  - stores the most recent `Html2FigmaDocument` in memory
- `content` script:
  - injects page selection behavior
  - highlights hovered elements
  - captures a clicked element as the conversion root
  - calls `convert(selectedElement)`
- `popup`:
  - starts full-page conversion
  - starts element selection mode
  - shows conversion status and summary
  - exposes copy, download, and open viewer actions
- `viewer` page:
  - displays formatted JSON
  - shows warnings summary
  - provides copy and download actions
- `shared`:
  - message types
  - JSON summary helpers
  - filename generation
  - lightweight error formatting

### User Flow

1. User opens the extension popup.
2. User chooses `Convert full page` or `Select element`.
3. Full-page conversion converts `document.body`.
4. Element selection mode adds a hover outline to elements on the active tab.
5. User clicks one element; the click is intercepted and normal page navigation is prevented.
6. The content script calls `convert(element)` and sends the document to the background worker.
7. The popup displays:
   - root name and type
   - root bounds
   - node count
   - resource count
   - warning count
8. User can open the viewer, copy JSON, or download a timestamped `.json` file.

### Selection Behavior

The first version supports single-element selection only.

Selection mode should:

- show a visible outline on hover
- avoid permanently changing page styles
- use capturing listeners to prevent accidental navigation during selection
- exit after one successful selection
- support cancellation from the popup

## Figma Plugin Design

The existing Figma plugin gallery moves under `example/figma-plugin/` and remains available.

### UI Tabs

The plugin UI has two tabs:

- `Blocks`: existing gallery of bundled HTML blocks.
- `Import JSON`: new JSON import workflow.

### Import JSON Flow

The `Import JSON` tab supports:

- paste JSON into a textarea
- upload a local `.json` file with a file input
- validate the parsed document
- show a document summary
- render valid documents into the current Figma page

Validation is lightweight and dependency-free:

- `version === 1`
- `root` exists
- `root.type` is one of `frame`, `text`, `rectangle`, `image`, or `svg`
- `resources` is an array
- `warnings` is an array

If validation succeeds, the UI sends:

```ts
{
  type: "render-json",
  document: Html2FigmaDocument,
  source: "paste" | "file"
}
```

The plugin main handles `render-json` by calling:

```ts
render(document, {
  parent: figma.currentPage,
  loadFonts: true
});
```

After rendering, the plugin selects the created root node, scrolls it into view, and reports warning count through `figma.notify()`.

## Build and Scripts

`example/package.json` becomes a workspace coordinator.

Recommended scripts:

```json
{
  "scripts": {
    "build": "npm run build -w figma-plugin && npm run build -w chrome-extension",
    "typecheck": "npm run typecheck -w figma-plugin && npm run typecheck -w chrome-extension",
    "dev:figma": "npm run dev -w figma-plugin",
    "dev:chrome": "npm run dev -w chrome-extension"
  }
}
```

The Chrome extension build should output a loadable `dist/` directory for Chrome's `Load unpacked` flow. The Figma plugin build should preserve the existing manifest sync and Vite plugin build behavior.

## Testing Strategy

Chrome extension:

- typecheck
- production build
- unit tests for:
  - message guards
  - summary generation
  - filename generation
  - selection state helpers

Figma plugin:

- typecheck
- production build
- unit tests for:
  - message guards
  - JSON document validation
  - import summary generation

Root library verification remains separate:

- `npm run verify`
- `npm run test:browser`

## Migration Plan

1. Move the current Figma example into `example/figma-plugin/`.
2. Update relative imports, Vite configs, manifest sync script, and package scripts.
3. Confirm existing block gallery behavior still builds.
4. Add the `Import JSON` tab and plugin message handling.
5. Add `example/chrome-extension/` with Manifest V3, popup, content script, background worker, and viewer page.
6. Add shared helper tests for both example apps.
7. Add README instructions for:
   - running the Figma plugin example
   - loading the Chrome extension unpacked
   - converting a webpage
   - importing JSON in Figma

## Success Criteria

- `cd example && npm run build` builds both example apps.
- `cd example && npm run typecheck` passes for both example apps.
- Existing Figma block gallery remains usable.
- Chrome extension can convert `document.body`.
- Chrome extension can visually select and convert one DOM element.
- Chrome extension can copy and download the generated JSON.
- Figma plugin can paste or upload the JSON and render it into Figma layers.
- Invalid JSON and invalid AST payloads produce clear UI errors.
