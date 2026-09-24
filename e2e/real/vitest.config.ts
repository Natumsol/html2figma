import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", fileParallelism: false,
  include: ["e2e/real/**/*.test.ts"] } });
