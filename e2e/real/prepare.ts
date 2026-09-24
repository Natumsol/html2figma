import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Html2FigmaDocument, Html2FigmaNode } from "html2figma";
import type { Assets } from "./host";
import type { VisualCase } from "./protocol";
import { sha256 } from "./build";

interface CaseSpec {
  name: string;
  fixture: "visual.html" | "fidelity.html";
  maxDiffPixelRatio: number;
  maxTextRegionDiffPixelRatio?: number;
  expectedWarningCodes: string[];
  expectedRenderWarningCodes?: string[];
  minImagePaints?: number;
  element?: string;
  expectedNodeType?: Html2FigmaNode["type"];
  expectedCss?: Record<string, string>;
  expectedTextStyle?: Record<string, string | number>;
  minTextLines?: number;
}

function findTarget(node: Html2FigmaNode, name: string): Html2FigmaNode | undefined {
  if (node.name.includes(`#${name}-target`)) return node;
  for (const child of node.children) {
    const found = findTarget(child, name);
    if (found) return found;
  }
  return undefined;
}

function findTextNode(node: Html2FigmaNode): Extract<Html2FigmaNode, { type: "text" }> | undefined {
  if (node.type === "text") return node;
  for (const child of node.children) {
    const found = findTextNode(child);
    if (found) return found;
  }
  return undefined;
}

function collectTextNodes(root: Html2FigmaNode): Array<Extract<Html2FigmaNode, { type: "text" }>> {
  const textNodes: Array<Extract<Html2FigmaNode, { type: "text" }>> = [];
  function collect(node: Html2FigmaNode): void {
    if (node.type === "text") textNodes.push(node);
    node.children.forEach(collect);
  }
  collect(root);
  return textNodes;
}

function textFocus(root: Html2FigmaNode): Pick<VisualCase,
  "textRegion" | "textInkColors" | "minTextInkRetention"> {
  const textNodes = collectTextNodes(root);
  if (!textNodes.length) throw new Error("Text comparison requires at least one text node");
  const left = Math.max(0, Math.floor(Math.min(...textNodes.map(node => node.bounds.x - root.bounds.x)) - 6));
  const top = Math.max(0, Math.floor(Math.min(...textNodes.map(node => node.bounds.y - root.bounds.y)) - 6));
  const right = Math.min(root.bounds.width,
    Math.ceil(Math.max(...textNodes.map(node => node.bounds.x + node.bounds.width - root.bounds.x)) + 6));
  const bottom = Math.min(root.bounds.height,
    Math.ceil(Math.max(...textNodes.map(node => node.bounds.y + node.bounds.height - root.bounds.y)) + 6));
  if (right <= left || bottom <= top) throw new Error("Text comparison region is empty");
  const textInkColors = textNodes.map(node => node.style.text?.color).filter(color => color !== undefined)
    .map(color => [color.r, color.g, color.b].map(channel => Math.round(channel * 255)) as [number, number, number]);
  if (!textInkColors.length) throw new Error("Text comparison requires a text color");
  return { textRegion: { x: left, y: top, width: right - left, height: bottom - top },
    textInkColors, minTextInkRetention: 0.45 };
}

export async function prepareCases(root: string, output: string, files: Assets) {
  const visual: unknown = JSON.parse(await readFile(join(root, "e2e/visual/cases.json"), "utf8"));
  const fidelity: unknown = JSON.parse(await readFile(join(root, "e2e/visual/fidelity-cases.json"), "utf8"));
  if (!Array.isArray(visual) || !Array.isArray(fidelity) || !visual.length || !fidelity.length) {
    throw new Error("Visual case specifications must be nonempty arrays");
  }
  const specs = [
    ...visual.map(entry => ({ ...entry, fixture: "visual.html" })),
    ...fidelity.map(entry => ({ ...entry, fixture: "fidelity.html" }))
  ] as CaseSpec[];
  if (specs.some(entry => !entry || typeof entry !== "object" ||
        typeof entry.name !== "string" || !/^[a-z-]+$/.test(entry.name) ||
        !Number.isFinite(entry.maxDiffPixelRatio) || entry.maxDiffPixelRatio < 0 || entry.maxDiffPixelRatio > 1 ||
        !Array.isArray(entry.expectedWarningCodes) ||
        !entry.expectedWarningCodes.every(code => typeof code === "string") ||
        (entry.expectedRenderWarningCodes !== undefined &&
          (!Array.isArray(entry.expectedRenderWarningCodes) ||
            !entry.expectedRenderWarningCodes.every(code => typeof code === "string"))) ||
        (entry.maxTextRegionDiffPixelRatio !== undefined &&
          (!Number.isFinite(entry.maxTextRegionDiffPixelRatio) ||
            entry.maxTextRegionDiffPixelRatio < 0 || entry.maxTextRegionDiffPixelRatio > 1)) ||
        (entry.expectedTextStyle !== undefined &&
          (typeof entry.expectedTextStyle !== "object" || Array.isArray(entry.expectedTextStyle) ||
            !Object.keys(entry.expectedTextStyle).length ||
            !Object.values(entry.expectedTextStyle).every(value =>
              typeof value === "string" || typeof value === "number" && Number.isFinite(value)))) ||
        (entry.minTextLines !== undefined && (!Number.isInteger(entry.minTextLines) || entry.minTextLines < 2)) ||
        (entry.minImagePaints !== undefined && (!Number.isInteger(entry.minImagePaints) || entry.minImagePaints < 0)) ||
        (entry.fixture === "fidelity.html" && (
          typeof entry.element !== "string" || !/^[a-z]+$/.test(entry.element) ||
          !["frame", "rectangle", "text", "image", "svg"].includes(entry.expectedNodeType ?? "") ||
          !entry.expectedCss || typeof entry.expectedCss !== "object" || Array.isArray(entry.expectedCss) ||
          !Object.keys(entry.expectedCss).length ||
          !Object.values(entry.expectedCss).every(value => typeof value === "string")
        ))) ||
      new Set(specs.map(entry => entry.name)).size !== specs.length) {
    throw new Error("Invalid visual case specification");
  }
  const converter = await readFile(join(root, "dist/convert.js"));
  const renderer = await readFile(join(root, "dist/render.js"));
  for (const [route, path, contentType] of [
    ["/__e2e/visual.html", "e2e/fixtures/visual.html", "text/html"],
    ["/__e2e/fidelity.html", "e2e/fixtures/fidelity.html", "text/html"],
    ["/__e2e/fidelity-product.png", "e2e/fixtures/fidelity-product.png", "image/png"],
    ["/__e2e/inter-latin-400-normal.woff2", "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", "font/woff2"],
    ["/__e2e/inter-latin-700-normal.woff2", "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2", "font/woff2"]
  ]) files.set(route, { bytes: await readFile(join(root, path)), contentType });
  const fidelityImageSource = `data:image/png;base64,${(await readFile(join(root,
    "e2e/fixtures/fidelity-product.png"))).toString("base64")}`;
  files.set("/__e2e/convert.js", { bytes: converter, contentType: "text/javascript" });
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1 });
    let currentFixture: CaseSpec["fixture"] | undefined;
    const cases: VisualCase[] = [];
    const references = new Map<string, Buffer>();
    for (const spec of specs) {
      if (currentFixture !== spec.fixture) {
        await page.goto(`http://localhost:5173/__e2e/${spec.fixture}`);
        if (spec.fixture === "fidelity.html") {
          await page.evaluate(source => {
            for (const image of Array.from(document.images)) image.src = source;
          }, fidelityImageSource);
        }
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(Array.from(document.images).map(image => image.decode()));
        });
        currentFixture = spec.fixture;
      }
      const { input, actualCss }: { input: Html2FigmaDocument; actualCss: Record<string, string> } =
        await page.evaluate(async ({ name, expectedCss }) => {
        const moduleUrl = "/__e2e/convert.js";
        const { convert } = await import(/* @vite-ignore */ moduleUrl);
        const element = document.getElementById(name);
        if (!element) throw new Error(`Missing fixture ${name}`);
        const target = document.getElementById(`${name}-target`);
        const computed = target ? window.getComputedStyle(target) : undefined;
        const actualCss = Object.fromEntries(Object.keys(expectedCss ?? {}).map(property =>
          [property, computed?.getPropertyValue(property).trim() ?? ""]));
        return { input: convert(element), actualCss };
      }, { name: spec.name, expectedCss: spec.expectedCss });
      if (spec.element) {
        const target = findTarget(input.root, spec.name);
        if (!target || target.source.tagName !== spec.element || target.type !== spec.expectedNodeType ||
            JSON.stringify(actualCss) !== JSON.stringify(spec.expectedCss)) {
          throw new Error(`Element/CSS contract mismatch for ${spec.name}: ${JSON.stringify(actualCss)}`);
        }
        if (spec.expectedTextStyle || spec.minTextLines) {
          const text = findTextNode(target);
          if (!text || Object.entries(spec.expectedTextStyle ?? {}).some(([property, value]) =>
              (text.style.text as unknown as Record<string, unknown> | undefined)?.[property] !== value) ||
              (spec.minTextLines !== undefined &&
                text.bounds.height < spec.minTextLines * (text.style.text?.lineHeight ?? 0))) {
            throw new Error(`Text contract mismatch for ${spec.name}`);
          }
        }
      }
      const documentJson = JSON.stringify(input);
      const width = input.root.bounds.width;
      const height = input.root.bounds.height;
      if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
          JSON.stringify(input.warnings.map(warning => warning.code)) !== JSON.stringify(spec.expectedWarningCodes)) {
        throw new Error(`Unexpected browser input for ${spec.name}`);
      }
      const reference = await page.locator(`#${spec.name}`).screenshot({ path: join(output, `${spec.name}-browser.png`) });
      await writeFile(join(output, `${spec.name}.document.json`), documentJson, { flag: "wx" });
      cases.push({ ...spec, documentJson, documentSha256: sha256(documentJson), width, height,
        ...(spec.maxTextRegionDiffPixelRatio === undefined ? {} : textFocus(input.root)) });
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
