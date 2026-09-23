import { expect, type Page } from "@playwright/test";
import { createFigmaRuntime } from "./figma-runtime";

export async function openPlugin(page: Page) {
  const runtime = await createFigmaRuntime();
  page.on("pageerror", (error) => runtime.state.errors.push(error.message));
  await page.exposeFunction("deliverPluginMessage", runtime.deliver);
  await page.goto("http://localhost:5173/__e2e/host.html");
  await page.locator("#plugin-shell").evaluate((element, html) => {
    (element as HTMLIFrameElement).srcdoc = html;
  }, runtime.state.shell);
  const ui = page.frameLocator("#plugin-shell").frameLocator("iframe");
  await expect(ui.getByRole("heading", { name: "Render HTML blocks into Figma" })).toBeVisible();
  return { ...runtime, ui };
}
