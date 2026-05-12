import type { Html2FigmaDocument } from "html2figma";
import { makeDownloadFilename, summarizeDocument } from "../shared/document";
import type { ExtensionMessage } from "../shared/messages";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("Missing #app");
}

app.innerHTML = `
  <main class="popup">
    <h1>html2figma Capture</h1>
    <p class="status" data-status>No capture yet.</p>
    <div class="actions">
      <button type="button" data-page>Convert full page</button>
      <button type="button" data-select>Select element</button>
      <button type="button" data-viewer>Open JSON</button>
      <button type="button" data-copy>Copy JSON</button>
      <button type="button" data-download>Download JSON</button>
    </div>
    <pre class="summary" data-summary></pre>
  </main>
`;

const status = app.querySelector<HTMLElement>("[data-status]")!;
const summary = app.querySelector<HTMLElement>("[data-summary]")!;

app.querySelector<HTMLButtonElement>("[data-page]")!.addEventListener("click", () => {
  void sendToActiveTab({ type: "convert-page" });
});

app.querySelector<HTMLButtonElement>("[data-select]")!.addEventListener("click", () => {
  void sendToActiveTab({ type: "start-selection" });
});

app.querySelector<HTMLButtonElement>("[data-viewer]")!.addEventListener("click", () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("src/viewer/index.html") });
});

app.querySelector<HTMLButtonElement>("[data-copy]")!.addEventListener("click", () => {
  void withLatestDocument(copyDocument);
});

app.querySelector<HTMLButtonElement>("[data-download]")!.addEventListener("click", () => {
  void withLatestDocument(downloadDocument);
});

void refreshSummary();

async function sendToActiveTab(message: ExtensionMessage): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    setStatus("No active tab.");
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, message);
    setStatus(
      message.type === "start-selection"
        ? "Click an element on the page."
        : "Conversion requested."
    );
    window.setTimeout(() => void refreshSummary(), 500);
  } catch {
    setStatus("Unable to reach this tab.");
  }
}

async function withLatestDocument(
  action: (document: Html2FigmaDocument) => Promise<void>
): Promise<void> {
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
  if (!document) {
    return;
  }

  summary.textContent = JSON.stringify(summarizeDocument(document), null, 2);
  setStatus("JSON ready.");
}

async function copyDocument(document: Html2FigmaDocument): Promise<void> {
  await navigator.clipboard.writeText(JSON.stringify(document, null, 2));
  setStatus("Copied JSON.");
}

async function downloadDocument(document: Html2FigmaDocument): Promise<void> {
  const blob = new Blob([JSON.stringify(document, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({
    url,
    filename: makeDownloadFilename(),
    saveAs: true
  });
  URL.revokeObjectURL(url);
  setStatus("Download started.");
}

function setStatus(message: string): void {
  status.textContent = message;
}
