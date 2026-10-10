import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  integrations: [react()],
  site: process.env.SITE_URL || "https://html2figma-one.vercel.app",
  trailingSlash: "always",
  vite: {
    plugins: [tailwindcss()],
    server: { headers: { "Access-Control-Allow-Origin": "*" } },
    preview: { headers: { "Access-Control-Allow-Origin": "*" } },
  },
});
