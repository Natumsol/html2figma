import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Html2FigmaDocument } from "html2figma";
import type { Assets } from "./host";
import type { VisualCase } from "./protocol";
import { sha256 } from "./build";

interface CaseSpec { name: string; maxDiffPixelRatio: number; expectedWarningCodes: string[] }

export async function prepareCases(root: string, output: string, files: Assets) {
  const specs = JSON.parse(await readFile(join(root, "e2e/visual/cases.json"), "utf8")) as CaseSpec[];
  if (specs.length !== 6 || new Set(specs.map(entry => entry.name)).size !== 6 ||
      specs.some(entry => !/^[a-z-]+$/.test(entry.name) || !Number.isFinite(entry.maxDiffPixelRatio) ||
        !Array.isArray(entry.expectedWarningCodes))) throw new Error("Invalid six-case visual specification");
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
    const cases: VisualCase[] = [];
    const references = new Map<string, Buffer>();
    for (const spec of specs) {
      const input: Html2FigmaDocument = await page.evaluate(async id => {
        const moduleUrl = "/__e2e/convert.js";
        const { convert } = await import(/* @vite-ignore */ moduleUrl);
        const element = document.getElementById(id);
        if (!element) throw new Error(`Missing fixture ${id}`);
        return convert(element);
      }, spec.name);
      const documentJson = JSON.stringify(input);
      const width = input.root.bounds.width;
      const height = input.root.bounds.height;
      if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
          JSON.stringify(input.warnings.map(warning => warning.code)) !== JSON.stringify(spec.expectedWarningCodes)) {
        throw new Error(`Unexpected browser input for ${spec.name}`);
      }
      const reference = await page.locator(`#${spec.name}`).screenshot({ path: join(output, `${spec.name}-browser.png`) });
      await writeFile(join(output, `${spec.name}.document.json`), documentJson, { flag: "wx" });
      cases.push({ ...spec, documentJson, documentSha256: sha256(documentJson), width, height });
      references.set(spec.name, reference);
    }
    await writeFile(join(output, "convert.js"), converter, { flag: "wx" });
    await writeFile(join(output, "render.js"), renderer, { flag: "wx" });
    await writeFile(join(output, "schema.js"), await readFile(join(root, "dist/index.js")), { flag: "wx" });
    return { cases, references, browserVersion: browser.version(),
      documentSha256: sha256(JSON.stringify(cases.map(entry => [entry.name, entry.documentSha256]))),
      converterSha256: sha256(converter), rendererSha256: sha256(renderer) };
  } finally { await browser.close(); }
}
