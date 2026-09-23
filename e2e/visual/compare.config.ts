import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: ".",
  testMatch: "compare.spec.ts",
  outputDir: "../../test-results/figma-diff",
  snapshotPathTemplate: fileURLToPath(new URL("../../test-results/figma-visual/{arg}{ext}", import.meta.url)),
  updateSnapshots: "none",
  reporter: [["list"], ["html", { outputFolder: "../../playwright-report/figma-visual", open: "never" }]]
});
