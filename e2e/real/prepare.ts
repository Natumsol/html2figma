import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Html2FigmaDocument } from "html2figma";
import type { Assets } from "./host";
import { sha256 } from "./build";

export async function prepareGeometry(root: string, output: string, files: Assets) {
  const converter = await readFile(join(root, "dist/convert.js"));
  const renderer = await readFile(join(root, "dist/render.js"));
  for (const [route, path, contentType] of [
    ["/__e2e/visual.html", "e2e/fixtures/visual.html", "text/html"],
    ["/__e2e/inter-latin-400-normal.woff2", "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", "font/woff2"]
  ]) files.set(route, { bytes: await readFile(join(root, path)), contentType });
  files.set("/__e2e/convert.js", { bytes: converter, contentType: "text/javascript" });
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1 });
    await page.goto("http://localhost:5173/__e2e/visual.html");
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map(image => image.decode()));
    });
    const input: Html2FigmaDocument = await page.evaluate(async () => {
      // Runtime import comes from the frozen reference server, not a test double.
      const moduleUrl = "/__e2e/convert.js";
      const { convert } = await import(/* @vite-ignore */ moduleUrl);
      return convert(document.getElementById("geometry"));
    });
    const documentJson = JSON.stringify(input);
    if (input.root.bounds.width !== 320 || input.root.bounds.height !== 180 || input.warnings.length) {
      throw new Error("Unexpected geometry fixture dimensions or warnings");
    }
    await writeFile(join(output, "geometry.document.json"), documentJson);
    await writeFile(join(output, "convert.js"), converter);
    await writeFile(join(output, "render.js"), renderer);
    await writeFile(join(output, "schema.js"), await readFile(join(root, "dist/index.js")));
    const reference = await page.locator("#geometry").screenshot({ path: join(output, "geometry-browser.png") });
    return { documentJson, reference, browserVersion: browser.version(),
      documentSha256: sha256(documentJson), converterSha256: sha256(converter), rendererSha256: sha256(renderer) };
  } finally { await browser.close(); }
}
