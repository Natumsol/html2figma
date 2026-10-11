import { test, expect } from '@playwright/test';

test('Preview pages stay out of search indexing and production Analytics', async ({ page }) => {
  for (const route of ['/', '/zh-cn/', '/zh-cn/docs/getting-started/', '/zh-cn/playground/']) {
    await page.goto(route);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
    const props = JSON.parse(await page.locator('vercel-analytics').getAttribute('data-props') || '{}');
    expect(props).toMatchObject({ mode: 'development', debug: false });
  }
});
