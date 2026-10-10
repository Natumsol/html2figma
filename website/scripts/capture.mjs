import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const origin = process.env.CAPTURE_URL || "http://127.0.0.1:4321";
await mkdir(".artifacts/screenshots", { recursive: true });
for (const [name, path, width, height] of [
  ["home-desktop", "/", 1440, 1000],
  ["home-mobile", "/zh-cn/", 390, 844],
  ["playground-desktop", "/playground/", 1440, 1100],
  ["playground-mobile", "/zh-cn/playground/", 390, 844],
  ["gallery-desktop", "/gallery/", 1440, 1300],
  ["gallery-mobile", "/zh-cn/gallery/", 390, 844],
  ["docs-desktop", "/docs/getting-started/", 1440, 1100],
]) {
  await page.setViewportSize({ width, height });
  await page.goto(`${origin}${path}`);
  await page.evaluate(() => document.fonts.ready);
  if (path.includes("playground"))
    await page.locator("#convert:not([disabled])").waitFor();
  if (path.includes("gallery"))
    await page.waitForFunction(
      () => document.querySelectorAll("[data-copy]:disabled").length === 0,
    );
  if (path === "/" || path === "/zh-cn/")
    await page.locator("#home-copy:not([disabled])").waitFor();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `.artifacts/screenshots/${name}.png` });
  if (name.includes("mobile")) {
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    for (let y = 0; y < height; y += 500) {
      await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
      await page.waitForTimeout(80);
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(900);
    await page.screenshot({
      path: `.artifacts/screenshots/${name}-full.png`,
      fullPage: true,
    });
  }
  if (name === "gallery-desktop" || name === "gallery-mobile") {
    for (const card of await page.locator("[data-case]").all()) {
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const id = await card.getAttribute("data-case");
      await card.screenshot({
        path: `.artifacts/screenshots/${name}-${id}.png`,
      });
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  }
  console.log(
    name,
    await page.evaluate(() => ({
      viewport: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
    })),
  );
}
await page.goto(`${origin}/playground/`);
await page.locator("#convert:not([disabled])").waitFor();
await page.locator("#convert").click();
await page.locator("#copy-json:not([disabled])").waitFor();
await writeFile(
  ".artifacts/site-document.json",
  await page.locator("#json-output").inputValue(),
);
await browser.close();
