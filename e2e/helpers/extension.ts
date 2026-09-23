import { test as base, chromium, type BrowserContext, type Page, type Worker } from "@playwright/test";
import { fileURLToPath } from "node:url";

export const test = base.extend<{ extension: { id: string; worker: Worker } }>({
  context: async ({ headless, viewport }, use) => {
    const extensionPath = fileURLToPath(new URL("../../example/chrome-extension/dist", import.meta.url));
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless,
      viewport,
      acceptDownloads: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });
    try {
      await use(context);
    } finally {
      await context.close();
    }
  },
  extension: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await use({ id: new URL(worker.url()).host, worker });
  }
});

export { expect } from "@playwright/test";

export async function openPopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  return popup;
}

export async function captureFromPopup(popup: Page, target: Page, mode: "page" | "selection") {
  await target.bringToFront();
  // A toolbar popup is not a normal tab. Dispatch its button event without
  // focusing the test's popup tab, so the real activeTab query sees the target.
  await popup.getByRole("button", {
    name: mode === "page" ? "Convert full page" : "Select element"
  }).dispatchEvent("click");
}
