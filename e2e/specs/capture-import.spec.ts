import { readFile } from "node:fs/promises";
import type { Html2FigmaDocument, Html2FigmaNode } from "../../src/schema/types";
import { test, expect, openPopup, captureFromPopup } from "../helpers/extension";
import { openPlugin } from "../helpers/plugin";
import { flattenScene } from "../helpers/figma-runtime";

function flattenAst(node: Html2FigmaNode): Html2FigmaNode[] {
  return [node, ...node.children.flatMap(flattenAst)];
}

test("shows the empty capture state without exporting a document", async ({ context, extension }) => {
  const popup = await openPopup(context, extension.id);
  await expect(popup.locator("[data-status]")).toHaveText("No capture yet.");
  await popup.getByRole("button", { name: "Download JSON" }).click();
  await expect(popup.locator("[data-status]")).toHaveText("No converted JSON available.");
  const opened = context.waitForEvent("page");
  await popup.getByRole("button", { name: "Open JSON" }).click();
  const viewer = await opened;
  await expect(viewer.locator("[data-summary]")).toHaveText("No converted document available.");
  await expect(viewer.locator("[data-json]")).toBeEmpty();
});

for (const mode of ["page", "selection"] as const) {
  test(`captures ${mode} and renders exported JSON through the plugin`, async ({ page, context, extension }, testInfo) => {
    await page.goto("http://localhost:5173/__e2e/capture.html");
    const popup = await openPopup(context, extension.id);
    await captureFromPopup(popup, page, mode);
    if (mode === "selection") {
      await expect(popup.locator("[data-status]")).toHaveText("Click an element on the page.");
      const card = page.locator("#capture-card");
      await card.hover({ position: { x: 8, y: 8 } });
      await expect(card).toHaveCSS("outline-style", "solid");
      await card.click({ position: { x: 8, y: 8 } });
      await expect(card).toHaveCSS("outline-style", "none");
    }

    // Read the real background response without supplying or rewriting its AST.
    await expect.poll(() => popup.evaluate(async () => {
      const response = await chrome.runtime.sendMessage({ type: "get-latest-document" });
      return Boolean(response?.document);
    })).toBe(true);
    await popup.reload();
    await expect(popup.locator("[data-status]")).toHaveText("JSON ready.");
    const opened = context.waitForEvent("page");
    await popup.getByRole("button", { name: "Open JSON" }).click();
    const viewer = await opened;
    await expect(viewer.locator("[data-json]")).not.toBeEmpty();
    const json = await viewer.locator("[data-json]").innerText();
    const document: Html2FigmaDocument = JSON.parse(json);
    const nodes = flattenAst(document.root);
    const text = nodes.filter((node) => node.type === "text").map((node) => node.text);
    expect(text).toContain("Captured product");
    expect(document.metadata.sourceUrl).toBe("http://localhost:5173/__e2e/capture.html");
    expect(document.resources.map((resource) => resource.type).sort()).toEqual(["image", "svg"]);
    expect(nodes.some((node) => node.name === "#border-top")).toBe(true);

    if (mode === "page") {
      expect(document.root.source.tagName).toBe("body");
      expect(text).toContain("Outside selection");
      expect(document.warnings.some((warning) => warning.code === "unsupported-transform")).toBe(true);
    } else {
      expect(document.root.name).toBe("section#capture-card");
      expect(document.root.bounds.width).toBe(360);
      expect(text).not.toContain("Outside selection");
      expect(document.warnings).toEqual([]);
    }

    const pluginPage = await context.newPage();
    const plugin = await openPlugin(pluginPage);
    await plugin.ui.getByRole("button", { name: "Import JSON", exact: true }).click();
    if (mode === "page") {
      const downloading = viewer.waitForEvent("download");
      await viewer.getByRole("button", { name: "Download JSON" }).click();
      const download = await downloading;
      // Chromium may expose the blob UUID here before chrome.downloads applies
      // its filename. Verify the downloaded JSON bytes, not the OS save dialog.
      expect(download.suggestedFilename()).toMatch(/\.json$/);
      const path = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(path);
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual(document);
      await plugin.ui.locator("[data-json-file]").setInputFiles(path);
    } else {
      await plugin.ui.getByPlaceholder("Paste Html2FigmaDocument JSON").fill(json);
      await plugin.ui.getByRole("button", { name: "Validate", exact: true }).click();
    }
    await expect(plugin.ui.locator("[data-render-json]")).toBeEnabled();
    const summary = JSON.parse(await plugin.ui.locator("[data-json-summary]").innerText());
    expect(summary).toMatchObject({ nodeCount: nodes.length, resourceCount: 2, warningCount: document.warnings.length });
    await plugin.ui.locator("[data-render-json]").click();
    await expect.poll(() => plugin.state.notifications.length).toBe(1);
    expect(plugin.state.messages[0]).toEqual({
      type: "render-json", source: mode === "page" ? "file" : "paste", document
    });
    expect(plugin.state.notifications[0]).toContain(`Rendered imported ${mode === "page" ? "file" : "paste"} JSON`);
    expect(plugin.state.errors).toEqual([]);
    expect(plugin.currentPage.children).toHaveLength(1);
    const root = plugin.currentPage.children[0];
    expect(plugin.currentPage.selection).toEqual([root]);
    expect(flattenScene(root)).toHaveLength(nodes.length);
    expect(flattenScene(root).filter((node) => node.type === "TEXT").map((node) => node.characters)).toEqual(text);
    expect(plugin.state.images).toHaveLength(1);
    expect(plugin.state.svgs).toHaveLength(1);
    const border = flattenScene(root).find((node) => node.name === "#border-top");
    expect(border).toMatchObject({ type: "RECTANGLE", width: 360, height: 4, layoutPositioning: "ABSOLUTE" });
    await testInfo.attach("captured-document", { body: json, contentType: "application/json" });
  });
}
