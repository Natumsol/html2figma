import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const directory = new URL("../src/data/examples/media/", import.meta.url);
const browser = await chromium.launch({ channel: "chromium" });
try {
  for (const [name, width, height] of [
    ["portrait", 320, 320],
    ["canvas", 1040, 560],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const svg = await readFile(new URL(`${name}.svg`, directory), "utf8");
    await page.setContent(
      `<style>body{margin:0}svg{display:block}</style>${svg}`,
    );
    await page.screenshot({
      path: fileURLToPath(new URL(`${name}.png`, directory)),
      omitBackground: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
