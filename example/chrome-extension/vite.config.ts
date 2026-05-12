import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

function copyManifest(): Plugin {
  return {
    name: "copy-extension-manifest",
    async writeBundle() {
      const target = resolve(__dirname, "dist/manifest.json");
      await mkdir(dirname(target), { recursive: true });
      await copyFile(resolve(__dirname, "manifest.json"), target);
    }
  };
}

export default defineConfig({
  plugins: [copyManifest()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
        viewer: resolve(__dirname, "src/viewer/index.html"),
        background: resolve(__dirname, "src/background/main.ts"),
        content: resolve(__dirname, "src/content/main.ts")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
