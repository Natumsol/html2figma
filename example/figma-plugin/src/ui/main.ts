import type { Html2FigmaDocument } from "html2figma";
import { convert } from "html2figma/convert";
import { parseDocumentJson, summarizeDocument } from "../shared/document";
import { blocks, type ExampleBlock } from "./blocks";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");
let importedDocument: Html2FigmaDocument | undefined;
let importedSource: "paste" | "file" = "paste";

if (!app) {
  throw new Error("Missing #app mount element");
}

app.innerHTML = `
  <div class="app">
    <header class="header">
      <div>
        <p class="eyebrow">html2figma example</p>
        <h1>Render HTML blocks into Figma</h1>
        <p class="subtitle">
          Convert bundled HTML previews or import JSON exported from the Chrome
          extension.
        </p>
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

hydrateTabs();
hydrateJsonImport();

for (const block of blocks) {
  void hydrateBlock(block);
}

function hydrateTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-tab]"));
  const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-panel]"));

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach((item) => item.classList.toggle("active", item === tab));
      panels.forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.panel === target);
      });
    });
  }
}

function hydrateJsonImport(): void {
  const input = document.querySelector<HTMLTextAreaElement>("[data-json-input]");
  const file = document.querySelector<HTMLInputElement>("[data-json-file]");
  const validate = document.querySelector<HTMLButtonElement>("[data-validate-json]");
  const renderButton = document.querySelector<HTMLButtonElement>("[data-render-json]");
  const summary = document.querySelector<HTMLElement>("[data-json-summary]");

  if (!input || !file || !validate || !renderButton || !summary) {
    return;
  }

  input.addEventListener("input", () => {
    importedDocument = undefined;
    renderButton.disabled = true;
    summary.textContent = "Validate the current JSON before rendering.";
  });

  validate.addEventListener("click", () => {
    loadJson(input.value, "paste", summary, renderButton);
  });

  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected) {
      return;
    }

    const value = await selected.text();
    input.value = value;
    loadJson(value, "file", summary, renderButton);
  });

  renderButton.addEventListener("click", () => {
    if (!importedDocument) {
      return;
    }

    window.parent.postMessage(
      {
        pluginMessage: {
          type: "render-json",
          source: importedSource,
          document: importedDocument
        }
      },
      "*"
    );
  });
}

function loadJson(
  value: string,
  source: "paste" | "file",
  summary: HTMLElement,
  renderButton: HTMLButtonElement
): void {
  try {
    importedDocument = parseDocumentJson(value);
    importedSource = source;
    summary.textContent = JSON.stringify(summarizeDocument(importedDocument), null, 2);
    renderButton.disabled = false;
  } catch (error) {
    importedDocument = undefined;
    renderButton.disabled = true;
    summary.textContent = error instanceof Error ? error.message : "Invalid JSON document.";
  }
}

function renderBlockCard(block: ExampleBlock): string {
  return `
    <article class="card" data-block-id="${escapeHtml(block.id)}">
      <div class="preview">
        <div class="preview-inner" data-preview></div>
      </div>
      <div class="card-body">
        <h2>${escapeHtml(block.title)}</h2>
        <p>${escapeHtml(block.description)}</p>
        <div class="actions">
          <button type="button" data-render-button>Render to Figma</button>
          <span class="status" role="status" aria-live="polite" data-status>Loading preview...</span>
        </div>
      </div>
    </article>
  `;
}

async function hydrateBlock(block: ExampleBlock): Promise<void> {
  const card = app?.querySelector<HTMLElement>(
    `[data-block-id="${cssEscape(block.id)}"]`
  );
  const previewInner = card?.querySelector<HTMLElement>("[data-preview]");
  const button = card?.querySelector<HTMLButtonElement>("[data-render-button]");
  const status = card?.querySelector<HTMLElement>("[data-status]");

  if (!card || !previewInner || !button || !status) {
    return;
  }

  try {
    const previewRoot = previewInner.attachShadow({ mode: "open" });
    previewRoot.innerHTML = await fetchBlockHtml(block.path);
    setStatus(status, "Ready");

    button.addEventListener("click", () => {
      void renderBlock(block, previewRoot, button, status);
    });
  } catch (error) {
    console.error(error);
    button.disabled = true;
    setStatus(status, "Failed to load preview", true);
  }
}

async function renderBlock(
  block: ExampleBlock,
  previewRoot: ShadowRoot,
  button: HTMLButtonElement,
  status: HTMLElement
): Promise<void> {
  const blockRoot = findBlockRoot(previewRoot);

  if (!blockRoot) {
    setStatus(status, "No block root found", true);
    return;
  }

  button.disabled = true;
  setStatus(status, "Converting...");

  try {
    const document = convert(blockRoot);
    window.parent.postMessage(
      {
        pluginMessage: {
          type: "render-block",
          blockId: block.id,
          document
        }
      },
      "*"
    );
    setStatus(status, "Sent to Figma");
  } catch (error) {
    console.error(error);
    setStatus(status, "Conversion failed", true);
  } finally {
    button.disabled = false;
  }
}

async function fetchBlockHtml(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }

  return response.text();
}

function findBlockRoot(container: ParentNode): HTMLElement | undefined {
  return Array.from(container.children).find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.tagName.toUpperCase() !== "STYLE"
  );
}

function setStatus(
  status: HTMLElement,
  message: string,
  isError = false
): void {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function cssEscape(value: string): string {
  return CSS.escape(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
