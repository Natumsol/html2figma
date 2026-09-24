import { expect, test } from "vitest";
import { chromium } from "@playwright/test";
import { createImageComparator } from "./images";

test("compares decoded PNG pixels and writes a diff for a visible color change", async () => {
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  const comparator = await createImageComparator();
  try {
    const page = await browser.newPage({ viewport: { width: 1, height: 1 }, deviceScaleFactor: 1 });
    await page.setContent('<body style="margin:0;background:#ff0000"></body>');
    const red = await page.screenshot();
    await page.setContent('<body style="margin:0;background:#0000ff"></body>');
    const blue = await page.screenshot();

    expect(await comparator.compare(red, red, 1, 1, 0)).toMatchObject({
      passed: true, differentPixels: 0, actualDiffPixelRatio: 0
    });
    const result = await comparator.compare(blue, red, 1, 1, 0);
    expect(result).toMatchObject({ passed: false, differentPixels: 1, actualDiffPixelRatio: 1 });
    expect(result?.errorMessage).toContain("1 pixels");
    expect(result?.diff?.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

    await page.setViewportSize({ width: 4, height: 4 });
    await page.setContent('<body style="margin:0;background:#ff0000"></body>');
    const redGrid = await page.screenshot();
    await page.setContent('<body style="margin:0;background:#ff0000"><div style="width:1px;height:1px;background:#0000ff"></div></body>');
    const changedCorner = await page.screenshot();
    expect(await comparator.compare(changedCorner, redGrid, 4, 4, 0.1)).toMatchObject({
      passed: true, differentPixels: 1, actualDiffPixelRatio: 0.0625
    });
    expect(await comparator.compare(changedCorner, redGrid, 4, 4, 0.1,
      { region: { x: 0, y: 0, width: 1, height: 1 }, maxDiffPixelRatio: 0,
        inkColors: [[255, 0, 0]], minInkRetention: 0.45 })).toMatchObject({
      passed: false, differentPixels: 1, actualDiffPixelRatio: 0.0625,
      textRegionDifferentPixels: 1, textRegionDiffPixelRatio: 1
    });
    expect(await comparator.compare(redGrid, changedCorner, 4, 4, 0.1,
      { region: { x: 0, y: 0, width: 4, height: 4 }, maxDiffPixelRatio: 0.12,
        inkColors: [[0, 0, 255]], minInkRetention: 0.45 })).toMatchObject({
      passed: false, differentPixels: 1, actualDiffPixelRatio: 0.0625,
      textRegionDifferentPixels: 1, textRegionDiffPixelRatio: 0.0625, textInkRetention: 0
    });
  } finally {
    await comparator.close();
    await browser.close();
  }
}, 15_000);
