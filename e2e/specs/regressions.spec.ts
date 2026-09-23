import { test, expect, type Page } from "@playwright/test";
import type { Html2FigmaDocument } from "../../src";
import { openPlugin } from "../helpers/plugin";

async function captureFixture(page: Page, id: string): Promise<Html2FigmaDocument> {
  await page.goto("/__e2e/visual.html");
  return page.evaluate(async (id) => {
    const url = "/__e2e/convert.js";
    const { convert } = await import(url);
    return convert(document.getElementById(id));
  }, id);
}

for (const name of ["flex-reverse", "flex-absolute"]) {
  test(`preserves browser geometry through JSON import for ${name}`, async ({ page }) => {
    const document = await captureFixture(page, name);
    const plugin = await openPlugin(page);
    await plugin.ui.getByRole("button", { name: "Import JSON", exact: true }).click();
    await plugin.ui.locator("[data-json-input]").fill(JSON.stringify(document));
    await plugin.ui.getByRole("button", { name: "Validate", exact: true }).click();
    await plugin.ui.locator("[data-render-json]").click();
    await expect.poll(() => plugin.state.notifications.length).toBe(1);
    expect(plugin.state.notifications[0]).toBe("Rendered imported paste JSON with 1 warning");
    expect(plugin.state.errors).toEqual([]);
    const root = plugin.currentPage.children[0];
    expect(root.layoutMode).toBeUndefined();
    expect(root.children).toHaveLength(document.root.children.length);
    for (const [index, child] of document.root.children.entries()) {
      expect(root.children[index]).toMatchObject({
        x: child.bounds.x - document.root.bounds.x,
        y: child.bounds.y - document.root.bounds.y,
        width: child.bounds.width, height: child.bounds.height
      });
    }
  });
}

test("rejects invalid nested values and resources after a successful import", async ({ page }) => {
  const document = await captureFixture(page, "typography");
  const invalidDimensions = structuredClone(document);
  invalidDimensions.root.children[0].bounds.width = -1;
  const invalidTextCase = structuredClone(document);
  Object.assign(invalidTextCase.root.children[0].style.text!, { textCase: "invalid" });
  const invalidResource = structuredClone(document);
  invalidResource.root.style.fills = [{ type: "image", resourceId: "missing", scaleMode: "fill", opacity: 1 }];
  const plugin = await openPlugin(page);
  await plugin.ui.getByRole("button", { name: "Import JSON", exact: true }).click();
  const input = plugin.ui.locator("[data-json-input]");
  const validate = plugin.ui.getByRole("button", { name: "Validate", exact: true });
  const render = plugin.ui.locator("[data-render-json]");
  await input.fill(JSON.stringify(document));
  await validate.click();
  await expect(render).toBeEnabled();
  for (const invalid of [invalidDimensions, invalidTextCase, invalidResource]) {
    await input.fill(JSON.stringify(invalid));
    await validate.click();
    await expect(render).toBeDisabled();
    await expect(plugin.ui.locator("[data-json-summary]")).toHaveText("JSON is not a valid html2figma document.");
  }
  expect(plugin.state.messages).toEqual([]);
  expect(plugin.currentPage.children).toEqual([]);
});

test("imports embedded PNG bytes without remote image requests", async ({ page }) => {
  const document = await captureFixture(page, "media");
  expect(document.resources[0].source).toMatch(/^data:image\/png;base64,/);
  const plugin = await openPlugin(page);
  await plugin.ui.getByRole("button", { name: "Import JSON", exact: true }).click();
  await plugin.ui.locator("[data-json-input]").fill(JSON.stringify(document));
  await plugin.ui.getByRole("button", { name: "Validate", exact: true }).click();
  await plugin.ui.locator("[data-render-json]").click();
  await expect.poll(() => plugin.state.notifications.length).toBe(1);
  expect(plugin.state.notifications[0]).toBe("Rendered imported paste JSON");
  expect(plugin.state.errors).toEqual([]);
  expect(plugin.state.images).toHaveLength(1);
  expect(Array.from(plugin.state.images[0].slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});
