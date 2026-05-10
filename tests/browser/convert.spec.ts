import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";

import type { Html2FigmaDocument } from "../../src/schema/types";

let server: ViteDevServer;
let serverUrl: string;

test.beforeAll(async () => {
  // @ts-expect-error The project tsconfig does not include Node types.
  const { fileURLToPath } = await import("node:url") as {
    fileURLToPath: (url: URL) => string;
  };

  server = await createServer({
    root: fileURLToPath(new URL("../..", import.meta.url)),
    server: {
      cors: true,
      host: "127.0.0.1",
      port: 0
    }
  });
  await server.listen();

  const address = server.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to start Vite server for browser convert test");
  }

  serverUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await server.close();
});

test("converts a basic card DOM tree into an AST document", async ({ page }) => {
  const fixtureUrl = new URL("../fixtures/basic-card.html", import.meta.url).href;

  await page.goto(fixtureUrl);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector(".card")!);
  }, serverUrl) as Html2FigmaDocument;

  expect(result.version).toBe(1);
  expect(result.root.type).toBe("frame");
  expect(result.root.name).toContain("div");
  expect(result.root.bounds.width).toBeGreaterThan(200);

  const firstFill = result.root.style.fills?.[0];
  expect(firstFill).toMatchObject({
    type: "solid",
    opacity: 1
  });

  expect(result.root.style.layout).toMatchObject({
    mode: "vertical",
    gap: 8
  });

  const firstChild = result.root.children[0];
  expect(firstChild?.type).toBe("frame");
  expect(firstChild?.children[0]).toMatchObject({
    type: "text",
    text: "Hello Figma"
  });
});

test("converts reviewed DOM edge cases", async ({ page }) => {
  await page.setContent(`
    <section id="root">
      <div class="row-reverse"><span>First</span><span>Second</span></div>
      <div class="empty"></div>
      <div class="copy">Nested text</div>
    </section>
    <style>
      .row-reverse {
        display: flex;
        flex-direction: row-reverse;
      }
    </style>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#root")!);
  }, serverUrl) as Html2FigmaDocument;

  const [rowReverse, empty, copy] = result.root.children;
  expect(rowReverse?.style.layout?.mode).toBe("horizontal");
  expect(empty?.type).toBe("frame");
  expect(copy?.children[0]?.source.path).toBe(`${copy?.source.path} > #text`);
});

test("applies maxDepth to text nodes", async ({ page }) => {
  await page.setContent(`
    <section id="root">
      Direct text
      <p>Nested text</p>
    </section>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#root")!, { maxDepth: 1 });
  }, serverUrl) as Html2FigmaDocument;

  expect(result.root.children).toHaveLength(2);
  expect(result.root.children[0]).toMatchObject({
    type: "text",
    text: "Direct text"
  });
  expect(result.root.children[1]).toMatchObject({
    type: "frame",
    children: []
  });
});

test("warns when converting an element with unsupported transform CSS", async ({ page }) => {
  await page.setContent(
    `<div id="target" style="transform: rotate(8deg); width: 100px; height: 50px;">Box</div>`
  );

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      code: "unsupported-transform",
      cssProperty: "transform"
    })
  );
});
