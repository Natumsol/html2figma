import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = new URL(`../../test-results/real-figma/runtime-${process.pid}.mjs`, import.meta.url);
await mkdir(new URL(".", output), { recursive: true });
await build({ entryPoints: [fileURLToPath(new URL("./runner.ts", import.meta.url))], bundle: true,
  platform: "node", format: "esm", packages: "external", target: "node22", outfile: fileURLToPath(output),
  define: { __PROJECT_ROOT__: JSON.stringify(root) } });
await import(output.href);
