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
  clean: true,
  splitting: false,
  target: "es2022"
});
