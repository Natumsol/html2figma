import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { PluginConfig } from "./protocol";

export const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

export async function buildPlugin(root: string, output: string, config: PluginConfig) {
  const entry = join(root, "e2e/real/plugin.ts");
  const template = await build({ entryPoints: [entry], bundle: true, format: "iife", target: "es2017", write: false,
    plugins: [{ name: "frozen-public-library", setup(builder) {
      builder.onResolve({ filter: /^html2figma\/render$/ }, () => ({ path: join(output, "render.js") }));
      builder.onResolve({ filter: /^html2figma$/ }, () => ({ path: join(output, "schema.js") }));
    } }] });
  // Hash the executable template once, then bind immutable session configuration.
  // No second bundle reads mutable source or dist files after this identity is fixed.
  const code = template.outputFiles[0].contents;
  config.identity.buildId = sha256(code);
  const bytes = Buffer.concat([Buffer.from(`const __REAL_CONFIG__=${JSON.stringify(config)};\n`), Buffer.from(code)]);
  const pluginDirectory = join(root, "test-results/real-figma/plugin");
  await mkdir(pluginDirectory, { recursive: true });
  await writeFile(join(output, "main.js"), bytes, { mode: 0o600, flag: "wx" });
  await writeFile(join(pluginDirectory, "main.next.js"), bytes, { mode: 0o600 });
  await rename(join(pluginDirectory, "main.next.js"), join(pluginDirectory, "main.js"));
  const manifest = { name: "html2figma Real E2E", id: "html2figma-real-e2e", api: "1.0.0", main: "main.js",
    editorType: ["figma"], documentAccess: "dynamic-page", enablePrivatePluginApi: true,
    networkAccess: { allowedDomains: ["http://localhost:5173"], devAllowedDomains: ["http://localhost:5173"],
      reasoning: "Local acceptance task and PNG transport" } };
  await writeFile(join(pluginDirectory, "manifest.json"), JSON.stringify(manifest, null, 2));
  return { manifest: join(pluginDirectory, "manifest.json"), pluginSha256: sha256(Buffer.from(bytes)) };
}

export async function assertNormalBuildIsolated(root: string): Promise<void> {
  const normal = await readFile(join(root, "example/figma-plugin/dist/plugin/main.js"), "utf8");
  if (["html2figma-real", "render-case", "__REAL_CONFIG__", "/bridge/"].some(marker => normal.includes(marker))) {
    throw new Error("Normal plugin build contains E2E control code");
  }
}
