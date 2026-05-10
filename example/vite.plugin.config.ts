import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/plugin",
    emptyOutDir: false,
    lib: {
      entry: "src/plugin/main.ts",
      formats: ["es"],
      fileName: () => "main.js"
    },
    rollupOptions: {
      output: {
        codeSplitting: false
      }
    },
    target: "es2022"
  }
});
