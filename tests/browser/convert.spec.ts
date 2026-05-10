import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";

import type { Html2FigmaDocument } from "../../src/schema/types";

let server: ViteDevServer;
let serverUrl: string;

test.beforeAll(async () => {
  server = await createServer({
    root: new URL("../..", import.meta.url).pathname,
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
