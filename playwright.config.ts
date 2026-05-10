import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  projects: [
    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ]
});
