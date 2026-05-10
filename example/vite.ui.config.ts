import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "blocks",
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*"
    }
  },
  build: {
    outDir: "dist/ui",
    emptyOutDir: false
  }
});
