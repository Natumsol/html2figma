import { expect, test } from "@playwright/test";

for (const language of ["", "zh-cn/"]) {
  test(`${language || "en"} document switching does not move content during initialization`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1401, height: 1344 });
    await page.addInitScript(() => {
      const shifts: number[] = [];
      (window as unknown as { documentShifts: number[] }).documentShifts =
        shifts;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const sources = (
            entry as PerformanceEntry & {
              sources: {
                node: Node | null;
                previousRect: DOMRectReadOnly;
                currentRect: DOMRectReadOnly;
              }[];
            }
          ).sources;
          for (const source of sources) {
            if (
              source.previousRect.height > 0 &&
              source.currentRect.height > 0 &&
              source.node instanceof Element &&
              source.node.closest(".docs-grid")
            ) {
              shifts.push(
                Math.abs(source.currentRect.y - source.previousRect.y),
              );
            }
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(`/${language}docs/support/`);
    await page.evaluate(() => document.fonts.ready);
    // Expose the initial static document before its modules initialize.
    await page.route("**/_astro/*.js", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.continue();
    });
    for (const slug of ["json", "convert", "getting-started"]) {
      await page
        .locator(`.docs-sidebar a[href="/${language}docs/${slug}/"]`)
        .click();
      await expect(page).toHaveURL(new RegExp(`/docs/${slug}/$`));
      await expect(
        page.locator(".code-block-bar button").first(),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle");
      const movement = await page.evaluate(() =>
        Math.max(
          0,
          ...(window as unknown as { documentShifts: number[] }).documentShifts,
        ),
      );
      expect(
        movement,
        `${slug} moved after the document appeared`,
      ).toBeLessThanOrEqual(1.5);
    }
  });
}
