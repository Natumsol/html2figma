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

test("uses inline text bounds instead of the parent element box", async ({ page }) => {
  await page.setContent(`
    <div id="target" style="padding: 12px 24px; width: 240px; font: 16px/20px Arial;">
      Render this hero
    </div>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const text = result.root.children[0];

  expect(text?.type).toBe("text");
  expect(text?.bounds.x).toBeGreaterThan(result.root.bounds.x + 20);
  expect(text?.bounds.y).toBeGreaterThan(result.root.bounds.y + 8);
  expect(text?.bounds.width).toBeGreaterThan(150);
  expect(text?.bounds.width).toBeLessThan(result.root.bounds.width);
});

test("captures CSS text-transform as AST text case", async ({ page }) => {
  await page.setContent(`
    <div id="target" style="font: 16px/20px Arial; text-transform: uppercase;">
      transformed label
    </div>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const text = result.root.children[0];

  expect(text?.type).toBe("text");
  expect(text?.style.text?.textCase).toBe("upper");
});

test("uses the parent box for centered text bounds", async ({ page }) => {
  await page.setContent(`
    <div id="target" style="box-sizing: border-box; width: 240px; padding: 12px 24px; text-align: center; font: 16px/20px Arial;">
      Centered label
    </div>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const text = result.root.children[0];

  expect(text?.type).toBe("text");
  expect(text?.bounds.x).toBe(result.root.bounds.x);
  expect(text?.bounds.width).toBe(result.root.bounds.width);
});

test("keeps mixed inline text bounds from overlapping inline element siblings", async ({ page }) => {
  await page.setContent(`
    <p id="target" style="font: 800 48px/54px Arial; margin: 0;">
      $29<span style="font-size: 16px; font-weight: 600;">/mo</span>
    </p>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const price = result.root.children[0];
  const period = result.root.children[1];

  expect(price?.type).toBe("text");
  expect(period?.type).toBe("frame");
  expect(price?.bounds.width).toBeGreaterThan(90);
  expect(price?.bounds.width).toBeLessThan(120);
});

test("converts example blocks with inline svg and image resources", async ({ page }) => {
  const cases = [
    {
      fixture: "icon-feature-card.html",
      selector: ".h2f-icon-card",
      expectedTypes: ["svg"]
    },
    {
      fixture: "image-product-card.html",
      selector: ".h2f-image-card",
      expectedTypes: ["image"],
      expectedImageMimeTypes: ["image/png"]
    },
    {
      fixture: "profile-media-card.html",
      selector: ".h2f-profile-card",
      expectedTypes: ["image", "svg"],
      expectedImageMimeTypes: ["image/png"]
    }
  ];

  for (const example of cases) {
    await page.goto(new URL(`../../example/figma-plugin/blocks/${example.fixture}`, import.meta.url).href);

    const result = await page.evaluate(async ({ baseUrl, selector }) => {
      const { convert } = await import(`${baseUrl}/src/convert.ts`);
      return convert(document.querySelector(selector)!);
    }, {
      baseUrl: serverUrl,
      selector: example.selector
    }) as Html2FigmaDocument;

    const nodeTypes = flattenNodeTypes(result.root);

    for (const expectedType of example.expectedTypes) {
      expect(nodeTypes).toContain(expectedType);
    }

    if (example.expectedImageMimeTypes) {
      const imageMimeTypes = result.resources
        .filter((resource) => resource.type === "image")
        .map((resource) => resource.mimeType);

      expect(imageMimeTypes).toEqual(example.expectedImageMimeTypes);
    }
  }
});

test("expands local SVG use references before storing resources", async ({ page }) => {
  await page.setContent(`
    <svg style="display: none;">
      <symbol id="check-icon" viewBox="0 0 10 10">
        <path d="M1 5l2 2 6-6"></path>
      </symbol>
    </svg>
    <svg id="target" width="10" height="10">
      <use href="#check-icon"></use>
    </svg>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const svgResource = result.resources.find((resource) => resource.type === "svg");
  expect(svgResource?.data).toContain("<path");
  expect(svgResource?.data).not.toContain("<use");
});

test("warns and preserves unresolved local SVG use references", async ({ page }) => {
  await page.setContent(`
    <svg id="target" width="10" height="10">
      <use href="#missing-icon"></use>
    </svg>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const svgResource = result.resources.find((resource) => resource.type === "svg");
  expect(svgResource?.data).toContain("<use");
  expect(result.warnings).toContainEqual(expect.objectContaining({
    code: "svg-use-unresolved",
    nodeId: result.root.id,
    source: "#missing-icon"
  }));
});

test("skips picture and source wrappers while preserving img currentSrc", async ({ page }) => {
  await page.setContent(`
    <picture id="target">
      <source srcset="https://example.com/wide.png" media="(min-width: 800px)">
      <img src="https://example.com/fallback.png" style="width: 120px; height: 80px;" alt="Fallback">
    </picture>
  `);

  const { currentSrc, result } = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    const image = document.querySelector("img")!;
    return {
      currentSrc: image.currentSrc,
      result: convert(document.querySelector("#target")!)
    };
  }, serverUrl) as { currentSrc: string; result: Html2FigmaDocument };

  const nodeTypes = flattenNodeTypes(result.root);
  expect(nodeTypes).not.toContain("source");
  expect(currentSrc).not.toBe("");
  expect(result.resources).toContainEqual(expect.objectContaining({
    type: "image",
    source: currentSrc
  }));
});

test("throws for an empty picture root instead of producing an empty frame", async ({ page }) => {
  await page.setContent(`<picture id="target"></picture>`);

  const message = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    try {
      convert(document.querySelector("#target")!);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, serverUrl);

  expect(message).toBe("Unable to convert root element");
});

test("converts video poster images into image nodes", async ({ page }) => {
  await page.setContent(`
    <video id="target" poster="poster.jpg" style="width: 200px; height: 120px;"></video>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  expect(result.root.type).toBe("image");
  expect(result.root.source.tagName).toBe("video");
  expect(result.resources).toContainEqual(expect.objectContaining({
    type: "image",
    source: expect.stringContaining("poster.jpg")
  }));
});

test("drops fallback children from video poster image nodes", async ({ page }) => {
  await page.setContent(`
    <video id="target" poster="poster.jpg" style="width: 200px; height: 120px;">
      Fallback text
    </video>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  expect(result.root.type).toBe("image");
  expect(result.root.children).toEqual([]);
});

test("warns when video has no poster image", async ({ page }) => {
  await page.setContent(`
    <video id="target" style="width: 200px; height: 120px;"></video>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  expect(result.root.type).not.toBe("image");
  expect(result.warnings).toContainEqual(expect.objectContaining({
    code: "video-poster-missing"
  }));
});

test("converts single CSS background image URLs into image fills", async ({ page }) => {
  await page.setContent(`
    <div id="target" style="
      width: 160px;
      height: 90px;
      background-image: url('https://example.com/card.png');
      background-size: contain;
    "></div>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const fill = result.root.style.fills?.find((item) => item.type === "image");
  expect(fill).toMatchObject({
    type: "image",
    scaleMode: "fit"
  });
  expect(result.resources).toContainEqual(expect.objectContaining({
    type: "image",
    source: "https://example.com/card.png"
  }));
});

test("keeps CSS background color behind background image fills", async ({ page }) => {
  await page.setContent(`
    <div id="target" style="
      width: 160px;
      height: 90px;
      background-color: rgb(12, 24, 48);
      background-image: url('https://example.com/card.png');
    "></div>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  expect(result.root.style.fills?.map((fill) => fill.type)).toEqual(["solid", "image"]);
});

test("warns for unsupported CSS background images", async ({ page }) => {
  await page.setContent(`
    <div id="target" style="width: 100px; height: 50px; background-image: linear-gradient(red, blue);"></div>
  `);

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  expect(result.warnings).toContainEqual(expect.objectContaining({
    code: "unsupported-background-image",
    cssProperty: "background-image"
  }));
});

test("warns when converting an element with unsupported transform CSS", async ({ page }) => {
  await page.setContent(
    `<div id="target" style="transform: rotate(8deg); width: 100px; height: 50px;">Box</div>`
  );

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  expect(result.warnings).toHaveLength(1);
  expect(result.root.warnings).toEqual(result.warnings);

  const warning = result.warnings[0]!;
  expect(warning).toMatchObject({
    code: "unsupported-transform",
    severity: "warning",
    nodeId: result.root.id,
    cssProperty: "transform",
    message: expect.any(String)
  });
  expect(warning.message).not.toHaveLength(0);

  if ("source" in warning) {
    expect(warning.source).toEqual(expect.any(String));
    expect(warning.source).not.toHaveLength(0);
  }
});

test("traverses open shadow roots with source path markers", async ({ page }) => {
  await page.setContent(`<custom-card id="target"></custom-card>`);
  await page.evaluate(() => {
    const host = document.querySelector("#target")!;
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <div class="shadow-title" style="font: 16px/20px Arial;">Shadow title</div>
    `;
  });

  const result = await page.evaluate(async (baseUrl) => {
    const { convert } = await import(`${baseUrl}/src/convert.ts`);
    return convert(document.querySelector("#target")!);
  }, serverUrl) as Html2FigmaDocument;

  const allPaths = collectSourcePaths(result.root);
  expect(allPaths.some((path) => path.includes("::shadow"))).toBe(true);
  expect(flattenTexts(result.root)).toContain("Shadow title");
});

function flattenNodeTypes(node: Html2FigmaDocument["root"]): string[] {
  return [node.type, ...node.children.flatMap(flattenNodeTypes)];
}

function collectSourcePaths(node: Html2FigmaDocument["root"]): string[] {
  return [node.source.path, ...node.children.flatMap(collectSourcePaths)];
}

function flattenTexts(node: Html2FigmaDocument["root"]): string[] {
  return [
    ...(node.type === "text" ? [node.text] : []),
    ...node.children.flatMap(flattenTexts)
  ];
}
