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

    expect(await comparator.compare(red, red, 1, 1, 0)).toBeNull();
    const result = await comparator.compare(blue, red, 1, 1, 0);
    expect(result?.errorMessage).toContain("1 pixels");
    expect(result?.diff?.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  } finally {
    await comparator.close();
    await browser.close();
  }
}, 15_000);
