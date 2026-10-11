import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { satteri } from "@astrojs/markdown-satteri";
import { codeBlocks } from "./scripts/code-blocks.mjs";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { environmentName, siteOrigin } from "./scripts/environment.mjs";

const mode = environmentName(process.env, process.env.NODE_ENV === 'development' ? 'development' : 'production');
// Astro evaluates this file before loading dotenv. Process values override local files.
const env = { ...loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), ''), ...process.env };

export default defineConfig({
  output: "static",
  devToolbar: { enabled: false },
  integrations: [react()],
  markdown: { processor: satteri({ hastPlugins: [codeBlocks] }) },
  site: siteOrigin(env, mode),
  trailingSlash: "always",
  vite: {
    define: { 'import.meta.env.PUBLIC_SITE_ENV': JSON.stringify(mode) },
    plugins: [tailwindcss()],
    server: { headers: { "Access-Control-Allow-Origin": "*" } },
    preview: { strictPort: true, headers: { "Access-Control-Allow-Origin": "*" } },
  },
});
