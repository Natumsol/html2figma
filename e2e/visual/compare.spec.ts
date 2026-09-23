import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const output = new URL("../../test-results/figma-visual/", import.meta.url);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const cases: Array<{ name: string; maxDiffPixelRatio: number; expectedWarningCodes: string[] }> =
  JSON.parse(await readFile(new URL("cases.json", import.meta.url), "utf8"));

for (const { name, maxDiffPixelRatio, expectedWarningCodes } of cases) {
  test(`real Figma canvas matches browser: ${name}`, async ({}, testInfo) => {
    const result = JSON.parse(await readFile(new URL(`${name}.result.json`, output), "utf8"));
    await testInfo.attach("figma-result", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
    const documentJson = await readFile(new URL(`${name}.document.json`, output), "utf8");
    const renderer = await readFile(new URL("../../dist/render.cjs", import.meta.url), "utf8");
    expect(result.name).toBe(name);
    const converter = await readFile(new URL("../../dist/convert.js", import.meta.url), "utf8");
    expect(result.converterSha256).toBe(sha256(converter));
    expect(result.rendererSha256).toBe(sha256(renderer));
    expect(result.documentSha256).toBe(sha256(documentJson));
    expect(result.rootNodeId).toEqual(expect.any(String));
    expect(result.createdNodeIds).toContain(result.rootNodeId);
    expect(result.warnings.map((warning: { code: string }) => warning.code)).toEqual(expectedWarningCodes);
    const bounds = JSON.parse(documentJson).root.bounds;
    expect(result.width).toBe(bounds.width);
    expect(result.height).toBe(bounds.height);
    const actual = Buffer.from(result.pngBase64, "base64");
    await testInfo.attach("figma-canvas", { body: actual, contentType: "image/png" });
    expect(actual).toMatchSnapshot(`${name}-browser.png`, {
      threshold: 0.2,
      maxDiffPixelRatio
    });
  });
}
