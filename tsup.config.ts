import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    convert: "src/convert.ts",
    render: "src/render.ts"
  },
  format: [
    "esm",
    "cjs"
  ],
  dts: true,
  sourcemap: true,
  // A watch rebuild must not remove files while example watchers read them.
  clean: !process.argv.includes("--watch"),
  splitting: false,
  target: "es2022"
});
