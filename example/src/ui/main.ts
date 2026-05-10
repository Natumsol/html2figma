import { convert } from "html2figma/convert";
import { blocks, type ExampleBlock } from "./blocks";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");

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
          Preview real browser-rendered HTML fragments, convert their DOM into an
          html2figma document, and send it to the plugin runtime.
        </p>
      </div>
    </header>
    <section class="gallery">
      ${blocks.map(renderBlockCard).join("")}
    </section>
  </div>
`;

for (const block of blocks) {
  void hydrateBlock(block);
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
