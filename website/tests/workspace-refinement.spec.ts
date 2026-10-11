import { expect, test } from "@playwright/test";

for (const language of ["", "zh-cn/"]) {
  test(`${language || "en"} workspace menus preserve deep links and capture width`, async ({
    page,
  }) => {
    await page.goto(`/${language}playground/?case=pricing-card`);
    await expect(page.locator("#convert")).toBeEnabled();
    const example = page.getByRole("combobox", {
      name: language ? "案例" : "Example",
      exact: true,
    });
    await expect(example).toContainText(language ? "定价卡片" : "Pricing card");
    await example.click();
    await page
      .getByRole("option", {
        name: language ? "功能卡片" : "Feature card",
        exact: true,
      })
      .click();
    await expect(page.locator("#case-select")).toHaveValue("icon-feature-card");
    await expect(page.locator("#convert")).toBeEnabled();
    const viewport = page.getByRole("combobox", {
      name: language ? "视口" : "Viewport",
      exact: true,
    });
    await viewport.focus();
    await viewport.press("Enter");
    await expect(
      page.getByRole("option", { name: "640 px", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("End");
    await expect(
      page.getByRole("option", { name: "1024 px", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(viewport).toContainText("1024 px");
    await expect(page.locator("#convert")).toBeEnabled();
    await page.locator("#convert").click();
    await expect(page.locator("#copy-json")).toBeEnabled();
    const json = await page.locator("#json-output").inputValue();
    expect(JSON.parse(json).metadata.viewport.width).toBe(1024);
    await page
      .getByRole("button", {
        name: language ? "原始尺寸" : "Actual size",
        exact: true,
      })
      .click();
    await expect(page.locator("#preview-frame")).toHaveCSS(
      "transform",
      "matrix(1, 0, 0, 1, 0, 0)",
    );
    expect(await page.locator("#json-output").inputValue()).toBe(json);
    await expect(page.locator(".preview-controls")).toContainText("100%");
    await expect(page.locator("select")).toHaveCount(0);
  });
}

test("workspace keeps zoom inside the canvas and surfaces errors without a ready banner", async ({
  page,
}) => {
  await page.goto("/zh-cn/playground/");
  await expect(page.locator("#convert")).toBeEnabled();
  await expect(page.locator(".workbench-status")).toHaveCSS(
    "clip-path",
    "inset(50%)",
  );
  const geometry = await page.locator(".preview-canvas").evaluate((canvas) => {
    const controls = canvas
      .querySelector(".preview-controls")!
      .getBoundingClientRect();
    const preview = canvas
      .querySelector(".preview-scroll")!
      .getBoundingClientRect();
    return {
      controls: { top: controls.top, bottom: controls.bottom },
      preview: { top: preview.top, bottom: preview.bottom },
    };
  });
  expect(geometry.controls.top).toBeGreaterThan(geometry.preview.top);
  expect(geometry.controls.bottom).toBeLessThan(geometry.preview.bottom);
  const content = page.getByRole("textbox", { name: "HTML", exact: true });
  await content.fill("x".repeat(200001));
  await expect(page.locator("#playground-status")).toContainText("200 KB");
  await expect(page.locator(".workbench-status")).toHaveCSS(
    "clip-path",
    "none",
  );
  await expect(page.locator("#convert")).toBeDisabled();
});
