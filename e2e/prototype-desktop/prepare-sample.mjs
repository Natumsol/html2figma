// THROWAWAY local-only input preparation; this does not exercise Figma.
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { server } from "../server.mjs";

const output = await mkdtemp(join(tmpdir(), "html2figma-desktop-sample-"));
let browser;
try {
  browser = await chromium.launch({ channel: "chromium" });
  const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:5173/__e2e/visual.html");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map(image => image.decode()));
  });
  const document = await page.evaluate(async () => {
    const { convert } = await import("/__e2e/convert.js");
    return convert(window.document.getElementById("geometry"));
  });
  const json = JSON.stringify(document);
  await writeFile(join(output, "geometry.document.json"), json);
  await page.locator("#geometry").screenshot({ path: join(output, "geometry-browser.png") });
  const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
  const state = {
    scope: "LOCAL_ONLY_BROWSER_PREPARATION",
    preparedAt: new Date().toISOString(), output, browserVersion: browser.version(),
    documentSha256: sha256(json),
    converterSha256: sha256(await readFile(new URL("../../dist/convert.js", import.meta.url))),
    rendererSha256: sha256(await readFile(new URL("../../dist/render.cjs", import.meta.url))),
    figmaRun: false, createdNodeIds: [], figmaPng: null
  };
  await writeFile(join(output, "state.json"), JSON.stringify(state, null, 2));
  console.log(JSON.stringify(state, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
