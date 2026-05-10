import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "blocks",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: "dist/ui",
    emptyOutDir: false
  }
});
