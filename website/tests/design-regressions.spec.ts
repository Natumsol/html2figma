import { expect, test } from "@playwright/test";

for (const language of ["", "zh-cn/"]) {
  for (const width of [375, 390]) {
    test(`mobile ${language || "en"} workspace at ${width}px keeps actions and views usable`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/${language}playground/`);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("#convert")).toBeEnabled();
      // Reserve space for a classic scrollbar too, even on overlay-scrollbar hosts.
      await page.addStyleTag({ content: "html{scrollbar-gutter:stable}" });
      const layout = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        actions: [...document.querySelectorAll(".toolbar-actions button")].map(
          (button) => ({
            left: button.getBoundingClientRect().left,
            right: button.getBoundingClientRect().right,
          }),
        ),
      }));
      expect(layout.scroll).toBeLessThanOrEqual(layout.width);
      layout.actions.forEach((button) => {
        expect(button.left).toBeGreaterThanOrEqual(0);
        expect(button.right).toBeLessThanOrEqual(layout.width);
      });
      await expect(page.locator("#preview-frame")).toBeInViewport();
      const tabs = page.locator(".mobile-workspace-tabs");
      await tabs
        .getByRole("tab", { name: language ? "源码" : "Source", exact: true })
        .click();
      await expect(
        page.getByRole("textbox", { name: "HTML", exact: true }),
      ).toBeVisible();
      await expect(page.locator("#preview-panel")).not.toBeVisible();
      await page.locator("#convert").click();
      await expect(page.locator("#copy-json")).toBeEnabled();
      await expect(page.locator("#preview-panel")).toBeVisible();
      const before = await page.locator("#json-output").inputValue();
      expect(JSON.parse(before).metadata.viewport.width).toBe(640);
      if (width === 390)
        await page.screenshot({
          path: `.artifacts/design-fixes/playground-${language ? "zh" : "en"}-mobile.png`,
        });
      await page.getByRole("button", { name: "100%", exact: true }).click();
      await expect(page.locator("#preview-frame")).toHaveCSS("width", "640px");
      expect(await page.locator("#json-output").inputValue()).toBe(before);
      await tabs.getByRole("tab", { name: "JSON", exact: true }).click();
      await expect(
        page.getByRole("textbox", { name: "JSON output", exact: true }),
      ).toBeVisible();
      await tabs
        .getByRole("tab", { name: language ? "诊断" : "Notes", exact: true })
        .click();
      await expect(page.locator("#warnings-output")).toBeVisible();
    });
  }
  test(`plugin ${language || "en"} guide preserves numbered installation steps`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/${language}docs/plugin/`);
    const lists = page.locator(".prose ol");
    await expect(lists).toHaveCount(2);
    for (const list of await lists.all()) {
      await expect(list).toHaveCSS("list-style-type", "decimal");
      expect(
        await list.evaluate((element) =>
          parseFloat(getComputedStyle(element).paddingInlineStart),
        ),
      ).toBeGreaterThan(16);
    }
    await expect(page.locator(".doc-download svg")).toBeVisible();
    await page.screenshot({
      path: `.artifacts/design-fixes/plugin-${language ? "zh" : "en"}-desktop.png`,
    });
  });
}

test("gallery enlargement restores focus and preserves native preview dimensions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery/");
  const card = page.locator("[data-case]").first();
  await expect(card.locator("[data-copy]")).toBeEnabled();
  const enlarge = card.getByRole("button", { name: /Enlarge preview/ });
  await enlarge.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toHaveText("Hero section");
  await expect(dialog.locator("iframe")).toHaveCSS("width", "640px");
  await expect(dialog.getByRole("status")).toContainText(
    "Browser input preview",
  );
  await page.screenshot({
    path: ".artifacts/design-fixes/gallery-enlarged-mobile.png",
  });
  await dialog.getByRole("button", { name: "100%", exact: true }).click();
  await expect(dialog.locator("iframe")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await expect(dialog.locator(".preview-scroll")).toHaveCSS(
    "overflow-x",
    "auto",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(enlarge).toBeFocused();
  const radii = await card.evaluate((element) => ({
    outer: parseFloat(getComputedStyle(element).borderRadius),
    inset: parseFloat(getComputedStyle(element).padding),
    inner: parseFloat(
      getComputedStyle(element.querySelector(".core")!).borderRadius,
    ),
  }));
  expect(radii.inner).toBe(radii.outer - radii.inset);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await expect(card.locator(".core")).toHaveCSS("display", "grid");
  const preview = await card.locator(".gallery-preview").boundingBox();
  const body = await card.locator(".gallery-body").boundingBox();
  expect(body!.x).toBeGreaterThan(preview!.x);
  await page.screenshot({
    path: ".artifacts/design-fixes/gallery-desktop.png",
    fullPage: true,
  });
});

test("home exposes actual text layers and offers the plugin at the handoff", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await expect(page.locator("#home-copy")).toBeEnabled();
  await expect(page.locator("#home-tree")).toContainText("Design stays");
  expect(await page.locator("#home-tree .tree-row").count()).toBeGreaterThan(2);
  await expect(page.locator(".showcase-handoff a")).toHaveAttribute(
    "href",
    "/docs/plugin/",
  );
  await page.screenshot({ path: ".artifacts/design-fixes/home-desktop.png" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const component of [
    page.locator('[data-slot="navigation-menu-link"]').first(),
    page.locator("#home-copy"),
  ]) {
    await expect(component).toHaveCSS(
      "transition-timing-function",
      "cubic-bezier(0.32, 0.72, 0, 1)",
    );
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#home-copy")).toHaveCSS(
    "transition-duration",
    "0s",
  );
});

test("selecting a home layer highlights its measured bounds without changing the JSON", async ({
  page,
}) => {
  await page.goto("/");
  const copy = page.locator("#home-copy");
  await expect(copy).toBeEnabled();
  await copy.click();
  const before = await page.evaluate(() => navigator.clipboard.readText());
  const document = JSON.parse(before);
  const pending = [document.root];
  let text;
  while (pending.length) {
    const node = pending.pop();
    if (node.type === "text" && node.text === "Design stays") text = node;
    pending.push(...node.children);
  }
  expect(text).toBeTruthy();
  const layer = page.locator("#home-tree button").first();
  await layer.click();
  await expect(layer).toHaveAttribute("aria-pressed", "true");
  const highlight = page
    .frameLocator("#home-preview")
    .locator("[data-preview-highlight]");
  await expect(highlight).toBeVisible();
  const bounds = await highlight.evaluate((element) =>
    element.getBoundingClientRect().toJSON(),
  );
  for (const key of ["x", "y", "width", "height"] as const)
    expect(bounds[key]).toBeCloseTo(text.bounds[key], 1);
  await copy.click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    before,
  );
  await layer.click();
  await expect(highlight).toHaveCount(0);
});

test("Chinese home retains a stronger headline and visible example previews on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh-cn/");
  await expect(page.locator("#home-copy")).toBeEnabled();
  const sizes = await page.evaluate(() => ({
    h1: parseFloat(getComputedStyle(document.querySelector("h1")!).fontSize),
    h2: parseFloat(getComputedStyle(document.querySelector("h2")!).fontSize),
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(sizes.h1).toBeGreaterThan(sizes.h2);
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width);
  await expect(page.locator(".featured-grid iframe")).toHaveCount(3);
  await page.screenshot({ path: ".artifacts/redesign/home-zh-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: ".artifacts/redesign/home-zh-desktop.png" });
});
