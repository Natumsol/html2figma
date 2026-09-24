import { chromium, expect, type BrowserContext, type Page } from "@playwright/test";
import { cp, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { parseDocumentJson, type Html2FigmaDocument } from "html2figma";
import type { Assets } from "./host";
import type { VisualCase } from "./protocol";
import { sha256 } from "./build";

interface CaptureSpec { name: "extension-page" | "extension-selection"; mode: "page" | "selection";
  fixture: string; selector: string }
const specs: CaptureSpec[] = [
  { name: "extension-page", mode: "page", fixture: "extension-page.html", selector: "body" },
  { name: "extension-selection", mode: "selection", fixture: "extension-selection.html", selector: "#capture-card" }
];

async function hashDirectory(directory: string): Promise<string> {
  const hash = createHash("sha256");
  async function visit(path: string): Promise<void> {
    for (const item of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const next = join(path, item.name);
      if (item.isDirectory()) await visit(next);
      else if (item.isFile()) {
        hash.update(relative(directory, next)); hash.update("\0");
        hash.update(await readFile(next)); hash.update("\0");
      }
    }
  }
  await visit(directory);
  return hash.digest("hex");
}

async function openPopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  return popup;
}

async function captureAndDownload(context: BrowserContext, extensionId: string, output: string,
  spec: CaptureSpec): Promise<{ documentJson: string; document: Html2FigmaDocument; reference: Buffer;
    downloadFilename: string; sourceUrl: string }> {
  const sourceUrl = `http://localhost:5173/__e2e/${spec.fixture}`;
  const target = await context.newPage();
  await target.goto(sourceUrl);
  await target.evaluate(async () => {
    await window.document.fonts.ready;
    await Promise.all(Array.from(window.document.images).map(image => image.decode()));
  });
  const popup = await openPopup(context, extensionId);
  await target.bringToFront();
  await popup.getByRole("button", { name: spec.mode === "page" ? "Convert full page" : "Select element" }).dispatchEvent("click");
  if (spec.mode === "selection") {
    await expect(popup.locator("[data-status]")).toHaveText("Click an element on the page.");
    const card = target.locator(spec.selector);
    await card.hover({ position: { x: 8, y: 8 } });
    await expect(card).toHaveCSS("outline-style", "solid");
    await card.click({ position: { x: 8, y: 8 } });
    await expect(card).toHaveCSS("outline-style", "none");
  }
  await expect.poll(() => popup.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "get-latest-document" });
    return Boolean(response?.document);
  }), { timeout: 10_000 }).toBe(true);
  const opened = context.waitForEvent("page");
  await popup.getByRole("button", { name: "Open JSON" }).click();
  const viewer = await opened;
  await expect(viewer.locator("[data-json]")).not.toBeEmpty();
  const downloaded = viewer.waitForEvent("download");
  await viewer.getByRole("button", { name: "Download JSON" }).click();
  const download = await downloaded;
  if (!download.suggestedFilename().endsWith(".json")) throw new Error(`Unexpected extension download: ${download.suggestedFilename()}`);
  await download.saveAs(join(output, `${spec.name}.extension.json`));
  const documentJson = await readFile(join(output, `${spec.name}.extension.json`), "utf8");
  // The plugin will independently run this same public JSON parser on the exact downloaded bytes.
  const document = parseDocumentJson(documentJson);
  if (document.metadata.sourceUrl !== sourceUrl || document.warnings.length ||
      document.root.bounds.width !== 320 || document.root.bounds.height !== 180 ||
      document.root.source.tagName !== (spec.mode === "page" ? "body" : "section")) {
    throw new Error(`Unexpected extension capture for ${spec.name}`);
  }
  if (spec.mode === "selection" && JSON.stringify(document).includes("Outside selection")) {
    throw new Error("Selection capture leaked outside content");
  }
  await target.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  const reference = await target.locator(spec.selector).screenshot({ path: join(output, `${spec.name}-browser.png`) });
  await popup.close(); await viewer.close(); await target.close();
  return { documentJson, document, reference, downloadFilename: download.suggestedFilename(), sourceUrl };
}

export async function prepareExtensionCases(root: string, output: string, files: Assets) {
  for (const spec of specs) files.set(`/__e2e/${spec.fixture}`, {
    bytes: await readFile(join(root, "e2e/fixtures", spec.fixture)), contentType: "text/html" });
  const extension = join(output, "extension-frozen");
  await cp(join(root, "example/chrome-extension/dist"), extension, { recursive: true, errorOnExist: true, force: false });
  const extensionSha256 = await hashDirectory(extension);
  const context = await chromium.launchPersistentContext("", { channel: "chromium", headless: true,
    viewport: { width: 800, height: 800 }, deviceScaleFactor: 1, acceptDownloads: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const extensionId = new URL(worker.url()).host;
    const cases: VisualCase[] = [];
    const references = new Map<string, Buffer>();
    for (const spec of specs) {
      const captured = await captureAndDownload(context, extensionId, output, spec);
      const documentSha256 = sha256(captured.documentJson);
      cases.push({ name: spec.name, documentJson: captured.documentJson, documentSha256,
        width: 320, height: 180, maxDiffPixelRatio: 0.02, expectedWarningCodes: [],
        capture: { mode: spec.mode, sourceUrl: captured.sourceUrl, extensionSha256,
          downloadFilename: captured.downloadFilename, downloadedJsonSha256: documentSha256 } });
      references.set(spec.name, captured.reference);
    }
    await writeFile(join(output, "extension-manifest.json"), JSON.stringify({ extensionSha256,
      cases: cases.map(({ documentJson, ...entry }) => entry), browserVersion: context.browser()?.version() ?? "unknown" }, null, 2), { flag: "wx" });
    return { cases, references, extensionSha256, browserVersion: context.browser()?.version() ?? "unknown" };
  } finally { await context.close(); }
}
