import { expect, test } from "@playwright/test";

for (const language of ["", "zh-cn/"]) {
  test(`${language || "en"} featured layout closes every grid corner and keeps previews intact`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${language}`);
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const grid = page.locator(".featured-grid");
      await grid.scrollIntoViewIfNeeded();
      await expect(
        grid.locator('.example-thumbnail[data-state="ready"]'),
      ).toHaveCount(3);
      const cards = await grid
        .locator(".featured-case")
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().toJSON()),
        );
      const [main, first, last] = cards;
      if (width >= 768) {
        expect(main!.y).toBeCloseTo(first!.y, 0);
        expect(main!.bottom).toBeCloseTo(last!.bottom, 0);
        expect(first!.x).toBeCloseTo(last!.x, 0);
        expect(first!.x).toBeGreaterThan(main!.right);
        expect(last!.y).toBeGreaterThan(first!.bottom);
        await expect(grid).toHaveCSS("grid-auto-flow", "dense");
      } else {
        expect(first!.x).toBeCloseTo(main!.x, 0);
        expect(first!.y).toBeGreaterThan(main!.bottom);
        expect(last!.y).toBeGreaterThan(first!.bottom);
      }
      for (const preview of await grid.locator(".example-thumbnail").all()) {
        const outer = await preview.boundingBox();
        const inner = await preview.locator("iframe").boundingBox();
        expect(inner!.x).toBeGreaterThanOrEqual(outer!.x);
        expect(inner!.y).toBeGreaterThanOrEqual(outer!.y);
        expect(inner!.x + inner!.width).toBeLessThanOrEqual(
          outer!.x + outer!.width,
        );
        expect(inner!.y + inner!.height).toBeLessThanOrEqual(
          outer!.y + outer!.height,
        );
        await expect(preview.locator("iframe")).toHaveCSS("width", "640px");
      }
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      if (width === 1440)
        await page.screenshot({
          path: `.artifacts/taste-fixes/grid-${language ? "zh" : "en"}.png`,
        });
    }
  });
}

test("walkthrough uses actual converted data and works with keyboard in reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/zh-cn/");
  await page.locator("#home-case").selectOption("icon-feature-card");
  await expect(page.locator("#home-copy")).toBeEnabled();
  await page.locator("#home-copy").click();
  const document = JSON.parse(
    await page.evaluate(() => navigator.clipboard.readText()),
  );
  const story = page.locator("[data-story]");
  await story.scrollIntoViewIfNeeded();
  await expect(story).toHaveAttribute("data-state", "ready");
  await expect(story).not.toHaveAttribute("data-motion", "scroll");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  const tabs = story.getByRole("tab");
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  const selected = story.locator('.tree-row[aria-pressed="true"]');
  await expect(selected).toContainText("Made to stay editable.");
  const sourceNodes = [document.root];
  let actual;
  while (sourceNodes.length) {
    const node = sourceNodes.pop();
    if (node.type === "text" && node.text === "Made to stay editable.")
      actual = node;
    sourceNodes.push(...node.children);
  }
  expect(actual).toBeTruthy();
  const overlay = story
    .frameLocator("iframe")
    .locator("[data-preview-highlight]");
  await expect(overlay).toBeVisible();
  const bounds = await overlay.evaluate((element) =>
    element.getBoundingClientRect().toJSON(),
  );
  for (const key of ["x", "y", "width", "height"] as const)
    expect(bounds[key]).toBeCloseTo(actual.bounds[key], 1);
  await tabs.nth(1).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  expect(JSON.parse(await story.locator(".story-json").innerText())).toEqual({
    type: actual.type,
    text: actual.text,
    bounds: actual.bounds,
    style: actual.style,
  });
  await expect(story.locator(".story-handoff")).toHaveAttribute(
    "href",
    "/zh-cn/docs/plugin/",
  );
  await page.screenshot({
    path: ".artifacts/taste-fixes/story-json-desktop.png",
  });
  await tabs.first().click();
  await expect(overlay).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await tabs.nth(1).click();
  await expect(selected).toBeVisible();
  await page.screenshot({
    path: ".artifacts/taste-fixes/story-mobile.png",
    fullPage: true,
  });
});

test("desktop scrolling advances the pinned story and releases it on mobile", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const story = page.locator("[data-story]");
  await story.scrollIntoViewIfNeeded();
  await expect(story).toHaveAttribute("data-motion", "scroll");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  const start = await page
    .locator(".pin-spacer")
    .evaluate((element) => element.getBoundingClientRect().top + scrollY - 110);
  for (const [offset, phase] of [
    [100, 0],
    [500, 1],
    [900, 2],
  ]) {
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: "instant" }),
      start + offset!,
    );
    await expect(story.getByRole("tab").nth(phase!)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const top = await story.evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    expect(top).toBeCloseTo(110, 0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await expect(story).not.toHaveAttribute("data-motion", "scroll");
  await story.getByRole("tab").first().click();
  await expect(story.getByRole("tab").first()).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("case previews respond to hover and keyboard focus without resizing the source", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const card = page.locator(".featured-case--primary");
  await card.scrollIntoViewIfNeeded();
  await expect(
    card.locator('.example-thumbnail[data-state="ready"]'),
  ).toBeVisible();
  await card.locator("a").hover();
  await expect
    .poll(() =>
      card
        .locator(".thumbnail-motion")
        .evaluate(
          (element) => new DOMMatrix(getComputedStyle(element).transform).a,
        ),
    )
    .toBeGreaterThan(1.03);
  await expect(card.locator("iframe")).toHaveCSS("width", "640px");
  await card.locator("a").focus();
  await expect(card.locator("a")).toBeFocused();
  await expect(card.locator("a")).toHaveCSS("outline-width", "3px");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/playground\/\?case=hero-section/);
});

test("changing motion preference never pins the story over earlier sections", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/zh-cn/");
  const story = page.locator("[data-story]");
  await story.scrollIntoViewIfNeeded();
  await expect(story).toHaveAttribute("data-state", "ready");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(story).toHaveAttribute("data-motion", "scroll");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect
    .poll(() =>
      story.evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeGreaterThan(1000);
  await expect(story).not.toHaveCSS("position", "fixed");
  const start = await page
    .locator(".pin-spacer")
    .evaluate((element) => element.getBoundingClientRect().top + scrollY - 110);
  await page.evaluate(
    (top) => window.scrollTo({ top, behavior: "instant" }),
    start + 500,
  );
  await expect(story.getByRole("tab").nth(1)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    await story.evaluate((element) => element.getBoundingClientRect().top),
  ).toBeCloseTo(110, 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await expect(story).not.toHaveCSS("position", "fixed");
});

test("conversion waits for the resized iframe before capturing viewport-dependent layout", async ({
  page,
}) => {
  await page.goto("/playground/");
  await expect(page.locator("#convert")).toBeEnabled();
  await page.getByRole("tab", { name: "HTML", exact: true }).click();
  await page
    .getByRole("textbox", { name: "HTML", exact: true })
    .fill('<section class="probe"><h1>Viewport settled</h1></section>');
  await page.getByRole("tab", { name: "CSS", exact: true }).click();
  await page
    .getByRole("textbox", { name: "CSS", exact: true })
    .fill(
      ".probe{height:420px;width:200px;background:#eee}@media(min-height:400px){.probe{width:360px}}",
    );
  await expect(page.locator("#convert")).toBeEnabled();
  await page.locator("#convert").click();
  await expect(page.locator("#copy-json")).toBeEnabled();
  const ast = JSON.parse(await page.locator("#json-output").inputValue());
  expect(ast.root.bounds.width).toBe(360);
  const real = await page
    .frameLocator("#preview-frame")
    .locator(".probe")
    .evaluate((element) => element.getBoundingClientRect().toJSON());
  for (const key of ["x", "y", "width", "height"] as const)
    expect(ast.root.bounds[key]).toBeCloseTo(real[key], 1);
});
