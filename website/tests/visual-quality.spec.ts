import { expect, test } from "@playwright/test";

test("sandboxed previews convert without external runner requests", async ({
  page,
}) => {
  const runnerRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/preview/runner.js")
      runnerRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#home-copy")).toBeEnabled({ timeout: 5000 });
  await expect(page.locator("#home-tree")).toContainText("Design stays");
  await expect(page.locator("#home-preview")).toHaveAttribute(
    "sandbox",
    "allow-scripts",
  );
  expect(runnerRequests).toEqual([]);
});

test("laptop hero exposes the complete conversion and handoff", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await expect(page.locator("#home-copy")).toBeEnabled();
  await expect(page.locator(".showcase-handoff")).toBeInViewport({ ratio: 1 });
  await expect(page.locator(".hero .button.primary")).toBeInViewport({
    ratio: 1,
  });
  expect(
    await page
      .locator(".layer-hint")
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(12);
});

test("mobile navigation closes with Escape and restores the morphing trigger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh-cn/");
  const trigger = page.getByRole("button", { name: "切换导航" });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "关闭导航" });
  await expect(close.locator("span")).toHaveCount(2);
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator("main")).not.toHaveAttribute("inert", "");
});

test("closing handoff preserves a dark core inside its shell", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const stage = page.locator(".closing-stage");
  await stage.scrollIntoViewIfNeeded();
  await expect(stage).not.toHaveCSS("background-image", "none");
  await expect(stage.getByRole("heading")).toBeVisible();
  await expect(
    stage.getByRole("link", { name: "Get the Figma plugin" }),
  ).toHaveAttribute("href", "/docs/plugin/");
});

test("home installation command copies only the executable command", async ({
  page,
}) => {
  await page.goto("/zh-cn/");
  const copy = page.getByRole("button", { name: "复制安装命令" });
  await expect(copy).toBeVisible();
  await copy.click();
  await expect(copy).toContainText("已复制");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "npm install html2figma",
  );
});

test("custom example menu supports keyboard selection and updates real conversion", async ({
  page,
}) => {
  await page.goto("/zh-cn/");
  await expect(page.locator("#home-copy")).toBeEnabled();
  const choose = page.getByRole("combobox", { name: "预览案例" });
  await expect(choose).toBeEnabled();
  await choose.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(
    page.getByRole("option", { name: "首页首屏", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: "功能卡片", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).not.toBeVisible();
  await expect(choose).toBeFocused();
  await expect(choose).toContainText("功能卡片");
  await expect(page.locator("#home-copy")).toBeEnabled();
  await expect(page.locator("#home-tree")).toContainText(
    "Made to stay editable.",
  );
  await expect(page.locator("#home-edit")).toHaveAttribute(
    "href",
    "/zh-cn/playground/?case=icon-feature-card",
  );
  await expect(page.locator(".showcase-source-heading")).toContainText(
    "01网页",
  );
  await expect(page.locator(".showcase-stage-label")).toContainText(
    "02转为 JSON",
  );
  await expect(page.locator(".showcase-handoff")).toContainText(
    "03在 Figma 生成图层",
  );
});
