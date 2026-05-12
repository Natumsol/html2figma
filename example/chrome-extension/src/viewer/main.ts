import type { Html2FigmaDocument } from "html2figma";
import { makeDownloadFilename, summarizeDocument } from "../shared/document";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("Missing #app");
}

app.innerHTML = `
  <main class="viewer">
    <header>
      <h1>html2figma JSON</h1>
      <div class="actions">
        <button type="button" data-copy>Copy JSON</button>
        <button type="button" data-download>Download JSON</button>
      </div>
    </header>
    <pre class="summary" data-summary></pre>
    <pre class="json" data-json></pre>
  </main>
`;

const summary = app.querySelector<HTMLElement>("[data-summary]")!;
const json = app.querySelector<HTMLElement>("[data-json]")!;
let currentDocument: Html2FigmaDocument | undefined;

void loadDocument();

app.querySelector<HTMLButtonElement>("[data-copy]")!.addEventListener("click", async () => {
  if (currentDocument) {
    await navigator.clipboard.writeText(JSON.stringify(currentDocument, null, 2));
  }
});

app.querySelector<HTMLButtonElement>("[data-download]")!.addEventListener("click", async () => {
  if (!currentDocument) {
    return;
  }

  const blob = new Blob([JSON.stringify(currentDocument, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({
    url,
    filename: makeDownloadFilename(),
    saveAs: true
  });
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
