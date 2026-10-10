import { expect, test, type Page } from "@playwright/test";
import { isHtml2FigmaDocument } from "html2figma";
import { unzipSync, strFromU8 } from "fflate";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

async function setSource(page: Page, language: "HTML" | "CSS", value: string) {
  await page.getByRole("tab", { name: language, exact: true }).click();
  await page.getByRole("textbox", { name: language, exact: true }).fill(value);
}

test("bilingual docs preserve the current page and all internal links resolve", async ({
  page,
  request,
}) => {
  await page.goto("/docs/convert/");
  await expect(page.locator("h1")).toHaveText("convert API");
  await page.locator(".language-link").click();
  await expect(page).toHaveURL(/\/zh-cn\/docs\/convert\//);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  for (const language of ["", "zh-cn/"]) {
    for (const slug of [
      "getting-started",
      "convert",
      "render",
      "json",
      "plugin",
      "support",
      "troubleshooting",
    ]) {
      const response = await request.get(`/${language}docs/${slug}/`);
      expect(response.status()).toBe(200);
    }
    for (const route of ["", "playground/", "gallery/"])
      expect((await request.get(`/${language}${route}`)).status()).toBe(200);
  }
  const links = await page
    .locator('a[href^="/"]')
    .evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href")!),
    );
  for (const href of new Set(links))
    expect((await request.get(href)).status(), href).toBe(200);
});

test("editable HTML/CSS converts, reports unsupported CSS and invalidates stale JSON", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/playground/");
  await setSource(
    page,
    "HTML",
    '<section><h1>My new canvas</h1><img alt="test" src="data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\"%3E%3Crect width=\"20\" height=\"20\" fill=\"red\"/%3E%3C/svg%3E"></section>',
  );
  await setSource(
    page,
    "CSS",
    "section { display:grid; width:320px; background:rgb(255,114,55) } h1 { font-size:24px }",
  );
  await expect(page.locator("#convert")).toBeEnabled();
  await page.locator("#convert").click();
  await expect(page.locator("#copy-json")).toBeEnabled();
  const value = await page.locator("#json-output").inputValue();
  const document = JSON.parse(value);
  expect(isHtml2FigmaDocument(document)).toBe(true);
  expect(
    document.warnings.some(
      (warning: { code: string }) => warning.code === "unsupported-css-grid",
    ),
  ).toBe(true);
  expect(JSON.stringify(document.root)).toContain("My new canvas");
  expect(
    document.resources.some(
      (resource: { type: string }) => resource.type === "image",
    ),
  ).toBe(true);
  await page.locator("#copy-json").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(value);
  const download = page.waitForEvent("download");
  await page.locator("#download-json").click();
  expect((await download).suggestedFilename()).toBe("html2figma.json");
  await setSource(page, "HTML", "<section>Changed</section>");
  await expect(page.locator("#copy-json")).toBeDisabled();
  await expect(page.locator("#json-output")).toHaveValue("");
  expect(errors).toEqual([]);
});

test("preview isolates user content and strips active HTML", async ({
  page,
}) => {
  await page.goto("/playground/");
  await setSource(
    page,
    "HTML",
    '<style>body{background:rgb(255,0,0)}</style><script>window.hacked=true;parent.document.body.innerHTML="hacked"</script><iframe src="https://example.com"></iframe><meta http-equiv="refresh" content="0;url=https://example.com"><h1 onclick="window.hacked=true">Safe input</h1>',
  );
  await setSource(page, "CSS", "h1 { font-size:20px }");
  await expect(page.locator("#convert")).toBeEnabled();
  const preview = page.frameLocator("#preview-frame");
  await expect(preview.locator("h1")).toHaveText("Safe input");
  await expect(preview.locator("h1")).not.toHaveAttribute("onclick");
  await expect(preview.locator("iframe")).toHaveCount(0);
  await expect(preview.locator("script")).toHaveCount(0);
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe("rgb(245, 246, 248)");
  await preview.locator("h1").click();
  expect(await preview.locator("h1").evaluate(() => "hacked" in window)).toBe(
    false,
  );
  await expect(page.locator("#preview-frame")).toHaveAttribute(
    "sandbox",
    "allow-scripts",
  );
});

test("all six gallery presets provide valid JSON and open the corresponding editor", async ({
  page,
}) => {
  await page.goto("/gallery/");
  const cards = page.locator("[data-case]");
  await expect(cards).toHaveCount(6);
  for (const card of await cards.all()) {
    const button = card.locator("[data-copy]");
    await expect(button).toBeEnabled();
    await button.click();
    const value = JSON.parse(
      await page.evaluate(() => navigator.clipboard.readText()),
    );
    expect(isHtml2FigmaDocument(value)).toBe(true);
    expect(value.metadata.viewport.width).toBe(640);
    expect(value.warnings).toEqual([]);
    expect(value.root.children.length).toBeGreaterThan(0);
  }
  await cards.nth(2).locator(".text-link").click();
  await expect(page.locator("#case-select")).toHaveValue("pricing-card");
  await expect(page.locator("#html-input")).toHaveValue(/h2f-pricing/);
});

test("mobile navigation works without horizontal page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh-cn/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".menu-toggle")).toBeVisible();
  await page.locator(".menu-toggle").click();
  await expect(page.locator(".menu-toggle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Playground", exact: true })
    .click();
  await expect(page).toHaveURL(/\/zh-cn\/playground\//);
  await expect(page.locator("#convert")).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("downloaded standalone plugin validates JSON and renders a converted site document", async ({
  page,
  request,
}) => {
  await page.goto("/playground/");
  await setSource(
    page,
    "HTML",
    '<div style="width:100px;height:80px;background:rgb(255,114,55)"></div>',
  );
  await setSource(page, "CSS", "");
  await expect(page.locator("#convert")).toBeEnabled();
  await page.locator("#convert").click();
  await expect(page.locator("#copy-json")).toBeEnabled();
  const document = JSON.parse(await page.locator("#json-output").inputValue());
  const release = JSON.parse(
    await readFile("src/data/generated/release.json", "utf8"),
  );
  const response = await request.get(release.plugin);
  expect(response.ok()).toBe(true);
  const zip = unzipSync(await response.body());
  const manifest = JSON.parse(strFromU8(zip["manifest.json"]!));
  const messages: unknown[] = [];
  let ui = "";
  const children: unknown[] = [];
  const node = () => ({
    type: "RECTANGLE",
    resize() {},
    remove() {},
    appendChild(child: unknown) {
      children.push(child);
    },
  });
  const figma = {
    currentPage: {
      appendChild(child: unknown) {
        children.push(child);
      },
      selection: [],
    },
    viewport: { scrollAndZoomIntoView() {} },
    createRectangle: node,
    createFrame: node,
    createText: node,
    ui: {
      postMessage(message: unknown) {
        messages.push(message);
      },
      onmessage: undefined as unknown,
    },
    showUI(html: string) {
      ui = html;
    },
    notify() {},
  };
  runInNewContext(strFromU8(zip[manifest.main]!), {
    figma,
    Uint8Array,
    console,
  });
  expect(ui).toContain("Import JSON");
  expect(ui).not.toContain("localhost");
  const handle = figma.ui.onmessage as (message: unknown) => Promise<void>;
  await handle({ type: "render", document: {} });
  expect(messages).toContainEqual({
    type: "error",
    message: "Invalid html2figma JSON.",
  });
  await handle({ type: "render", document });
  expect(messages).toContainEqual(expect.objectContaining({ type: "done" }));
  expect(children.length).toBeGreaterThan(0);
});

test("mobile menu traps focus, closes with Escape and restores content access", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.locator(".menu-toggle");
  await toggle.click();
  await expect(
    page.getByRole("dialog").getByRole("link").first(),
  ).toBeFocused();
  expect(
    await page
      .locator("main")
      .evaluate((element) => element instanceof HTMLElement && element.inert),
  ).toBe(true);
  await page.getByRole("link", { name: "GitHub", exact: true }).press("Tab");
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Close navigation" }),
  ).toBeFocused();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close navigation" })
    .press("Shift+Tab");
  await expect(
    page.getByRole("link", { name: "GitHub", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  expect(
    await page
      .locator("main")
      .evaluate((element) => element instanceof HTMLElement && element.inert),
  ).toBe(false);
});

test("real home conversion can be copied and responsive sections never overlap", async ({
  page,
}) => {
  for (const route of ["/", "/zh-cn/"]) {
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(route);
      await expect(page.locator("#home-copy")).toBeEnabled();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}`,
      ).toBe(true);
      const showcase = await page.locator(".live-showcase").boundingBox();
      const integration = await page
        .locator(".integration-section")
        .boundingBox();
      expect(showcase!.y + showcase!.height).toBeLessThan(integration!.y);
    }
  }
  await page.locator("#home-copy").click();
  expect(
    isHtml2FigmaDocument(
      JSON.parse(await page.evaluate(() => navigator.clipboard.readText())),
    ),
  ).toBe(true);
  await page.locator("#home-case").selectOption("image-product-card");
  await expect(page.locator("#home-copy")).toBeEnabled();
  await expect(page.locator("#home-edit")).toHaveAttribute(
    "href",
    /case=image-product-card/,
  );
});

test("source and result tabs support keyboard navigation with readable diagnostics", async ({
  page,
}) => {
  await page.goto("/playground/");
  await page
    .getByRole("tab", { name: "HTML", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "CSS", exact: true }),
  ).toBeFocused();
  await expect(page.locator("#css-panel")).toBeVisible();
  await setSource(page, "HTML", "<div>Grid fallback</div>");
  await setSource(page, "CSS", "div{display:grid;width:300px}");
  await expect(page.locator("#convert")).toBeEnabled();
  await page.locator("#convert").click();
  await expect(page.locator("#copy-json")).toBeEnabled();
  await page.getByRole("tab", { name: /Diagnostics/ }).click();
  await expect(page.locator("#warnings-output")).toContainText(
    "unsupported-css-grid",
  );
  await expect(
    page.locator("#warnings-output .diagnostic-item p").first(),
  ).not.toBeEmpty();
  await page.getByRole("tab", { name: "JSON", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "JSON output" }),
  ).toBeVisible();
  await expect(page.locator("#copy-json")).toBeInViewport();
});

test("mobile document copy controls do not cover code and gallery explains sample data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh-cn/docs/getting-started/");
  for (const block of await page.locator(".prose .code-block").all()) {
    const bar = await block.locator(".code-block-bar").boundingBox();
    const pre = await block.locator("pre").boundingBox();
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(pre!.y + 1);
    expect(
      await block
        .locator("pre")
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    ).toBeGreaterThanOrEqual(13);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/gallery/");
  await expect(page.locator(".gallery-note")).toContainText("illustrative");
  await expect(page.locator('[data-case="stats-panel"] h2')).toHaveText(
    "Statistics panel",
  );
  await expect(
    page.frameLocator('[data-case="stats-panel"] iframe').locator("body"),
  ).not.toContainText("94%");
});
