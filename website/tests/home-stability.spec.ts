import { expect, test } from "@playwright/test";

for (const [width, height] of [
  [1469, 1344],
  [390, 844],
] as const) {
  for (const motion of ["reduce", "no-preference"] as const) {
    test(`case switching keeps surrounding content still at ${width}px with ${motion}, including loading`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await page.setViewportSize({ width, height });
      await page.goto("/zh-cn/");
      await expect(page.locator("#home-copy")).toBeEnabled();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator(".hero-copy")).toHaveCSS("opacity", "1");
      const geometry = () =>
        page.evaluate(() => ({
          copy: document.querySelector(".hero-copy")!.getBoundingClientRect().y,
          collection: document
            .querySelector(".home-cases")!
            .getBoundingClientRect().y,
          x: document.querySelector(".hero")!.getBoundingClientRect().x,
          width: document.querySelector(".hero")!.getBoundingClientRect().width,
          scroll: scrollY,
        }));
      const before = await geometry();
      await page.evaluate(() => {
        const target = window as typeof window & {
          switchSamples: number[][];
          switchTimer: number;
        };
        target.switchSamples = [];
        target.switchTimer = window.setInterval(() => {
          target.switchSamples.push([
            document.querySelector(".hero-copy")!.getBoundingClientRect().y,
            document.querySelector(".home-cases")!.getBoundingClientRect().y,
            document.querySelector(".hero")!.getBoundingClientRect().x,
            document.querySelector(".hero")!.getBoundingClientRect().width,
            scrollY,
          ]);
        }, 10);
      });
      for (const name of ["功能卡片", "图片卡片", "首页首屏"]) {
        await page.getByRole("combobox", { name: "预览案例" }).click();
        await page.getByRole("option", { name, exact: true }).click();
        await expect(page.locator("#home-copy")).toBeEnabled();
        await expect(page.locator("[data-home-showcase]")).toHaveAttribute(
          "data-state",
          "ready",
        );
        const area = await page.locator(".showcase-preview").boundingBox();
        const source = await page.locator("#home-preview").boundingBox();
        expect(source!.x).toBeGreaterThanOrEqual(area!.x - 1);
        expect(source!.y).toBeGreaterThanOrEqual(area!.y - 1);
        expect(source!.x + source!.width).toBeLessThanOrEqual(
          area!.x + area!.width + 1,
        );
        expect(source!.y + source!.height).toBeLessThanOrEqual(
          area!.y + area!.height + 1,
        );
        await expect(page.locator("#home-preview")).toHaveCSS("width", "640px");
      }
      const samples = await page.evaluate(() => {
        const target = window as typeof window & {
          switchSamples: number[][];
          switchTimer: number;
        };
        clearInterval(target.switchTimer);
        return target.switchSamples;
      });
      const baseline = [
        before.copy,
        before.collection,
        before.x,
        before.width,
        before.scroll,
      ];
      expect(samples.length).toBeGreaterThan(0);
      for (const [index, name] of [
        "hero text",
        "next section",
        "horizontal position",
        "container width",
        "scroll position",
      ].entries()) {
        const movement = Math.max(
          ...samples.map((sample) =>
            Math.abs(sample[index]! - baseline[index]!),
          ),
        );
        expect(
          movement,
          `${name} moved during case switching`,
        ).toBeLessThanOrEqual(1);
      }
    });
  }
}
