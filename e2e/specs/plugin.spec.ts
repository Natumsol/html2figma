import { test, expect } from "@playwright/test";
import { openPlugin } from "../helpers/plugin";
import { flattenScene } from "../helpers/figma-runtime";

const examples = [
  { id: "hero-section", text: "Turn HTML sections into editable Figma layers.", width: 560 },
  { id: "pricing-card", text: "Start rendering", width: 360 },
  { id: "stats-panel", text: "Conversion dashboard", width: 640 },
  { id: "icon-feature-card", text: "Inline SVG icon support", width: 380, svg: true },
  { id: "image-product-card", text: "Local image render path", width: 420, image: true },
  { id: "profile-media-card", text: "Image plus SVG icon", width: 460, image: true, svg: true }
];

for (const example of examples) {
  test(`renders built-in ${example.id} through the plugin shell`, async ({ page }) => {
    const plugin = await openPlugin(page);
    const card = plugin.ui.locator(`[data-block-id="${example.id}"]`);
    await expect(card.getByRole("status")).toHaveText("Ready");
    await card.getByRole("button", { name: "Render to Figma" }).click();
    await expect.poll(() => plugin.state.notifications.length).toBe(1);

    expect(plugin.state.messages[0]).toMatchObject({ type: "render-block", blockId: example.id });
    expect(plugin.state.notifications[0]).toContain(`Rendered ${example.id}`);
    expect(plugin.state.errors).toEqual([]);
    expect(plugin.currentPage.children).toHaveLength(1);
    const root = plugin.currentPage.children[0];
    expect(root.width).toBe(example.width);
    expect(root.height).toBeGreaterThan(0);
    expect(plugin.currentPage.selection).toEqual([root]);
    expect(plugin.state.zoomedNodes).toEqual([root]);
    const texts = flattenScene(root).filter((node) => node.type === "TEXT");
    expect(texts.length).toBeGreaterThan(0);
    if (example.text) expect(texts.map((node) => node.characters)).toContain(example.text);
    expect(plugin.state.fonts.length).toBeGreaterThan(0);
    if (example.svg) expect(plugin.state.svgs[0]).toContain("<svg");
    if (example.image) {
      expect(plugin.state.images).toHaveLength(1);
      expect(Array.from(plugin.state.images[0].slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(flattenScene(root).some((node) => node.fills.some((fill) => fill.type === "IMAGE"))).toBe(true);
    }
  });
}

test("rejects malformed and unsupported JSON before sending to Figma", async ({ page }) => {
  const plugin = await openPlugin(page);
  await plugin.ui.getByRole("button", { name: "Import JSON", exact: true }).click();
  const input = plugin.ui.getByPlaceholder("Paste Html2FigmaDocument JSON");
  const render = plugin.ui.locator("[data-render-json]");
  await expect(render).toBeDisabled();
  for (const [json, message] of [
    ["not json", "JSON could not be parsed."],
    ['{"version":99}', "JSON is not a valid html2figma document."]
  ]) {
    await input.fill(json);
    await plugin.ui.getByRole("button", { name: "Validate", exact: true }).click();
    await expect(plugin.ui.locator("[data-json-summary]")).toHaveText(message);
    await expect(render).toBeDisabled();
    expect(plugin.state.messages).toEqual([]);
    expect(plugin.currentPage.children).toEqual([]);
  }
});

test("disables a failed preview while other blocks remain usable", async ({ page }) => {
  await page.route("**/hero-section.html", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  const plugin = await openPlugin(page);
  const failed = plugin.ui.locator('[data-block-id="hero-section"]');
  await expect(failed.getByRole("status")).toHaveText("Failed to load preview");
  await expect(failed.getByRole("button")).toBeDisabled();
  const working = plugin.ui.locator('[data-block-id="pricing-card"]');
  await expect(working.getByRole("status")).toHaveText("Ready");
  await working.getByRole("button").click();
  await expect.poll(() => plugin.state.notifications.length).toBe(1);
  expect(plugin.state.notifications[0]).toContain("Rendered pricing-card");
});
