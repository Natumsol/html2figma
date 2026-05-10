import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "blocks",
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: "dist/ui",
    emptyOutDir: false
  }
});
