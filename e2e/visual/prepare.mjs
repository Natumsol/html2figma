import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { server } from "../server.mjs";

const output = new URL("../../test-results/figma-visual/", import.meta.url);
const cases = JSON.parse(await readFile(new URL("cases.json", import.meta.url), "utf8"));
const names = cases.map(entry => entry.name);
const converter = await readFile(new URL("../../dist/convert.js", import.meta.url), "utf8");
const renderer = await readFile(new URL("../../dist/render.cjs", import.meta.url), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
let browser;

try {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ channel: "chromium" });
  const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:5173/__e2e/visual.html");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map(image => image.decode()));
  });

  for (const name of names) {
    const document = await page.evaluate(async (id) => {
      const { convert } = await import("/__e2e/convert.js");
      return convert(window.document.getElementById(id));
    }, name);
    const json = JSON.stringify(document);
    await writeFile(new URL(`${name}.document.json`, output), json);
    await page.locator(`#${name}`).screenshot({ path: new URL(`${name}-browser.png`, output).pathname });
    // Run the built public renderer itself in use_figma. The CommonJS wrapper
    // only exposes its exports; it does not replace any Figma API or renderer.
    const code = `const module = { exports: {} };
${renderer}
const inputDocument = ${json};
const x = Math.max(0, ...figma.currentPage.children.map(node => node.x + node.width)) + 100;
const result = await module.exports.render(inputDocument, { x, y: 100, loadFonts: true });
const png = await result.root.exportAsync({
  format: "PNG", constraint: { type: "SCALE", value: 1 },
  colorProfile: "SRGB", useAbsoluteBounds: true
});
return {
  name: ${JSON.stringify(name)},
  rendererSha256: ${JSON.stringify(sha256(renderer))},
  converterSha256: ${JSON.stringify(sha256(converter))},
  documentSha256: ${JSON.stringify(sha256(json))},
  rootNodeId: result.root.id,
  createdNodeIds: result.nodes.map(node => node.id),
  width: result.root.width,
  height: result.root.height,
  warnings: result.warnings,
  pngBase64: figma.base64Encode(png)
};
`;
    await writeFile(new URL(`${name}.render.js`, output), code);
  }
  await writeFile(new URL("manifest.json", output), JSON.stringify({
    names, rendererSha256: sha256(renderer), converterSha256: sha256(converter), browserVersion: browser.version(),
    preparedAt: new Date().toISOString()
  }, null, 2));
  console.log(`Prepared ${names.length} browser references and Figma scripts in ${output.pathname}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
