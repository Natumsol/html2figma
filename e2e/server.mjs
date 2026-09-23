import { createServer } from "node:http";
import { readFile, access } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const ui = resolve(root, "example/figma-plugin/dist/ui");
const fixtures = resolve(root, "e2e/fixtures");

// Fail before reporting readiness if the production artifacts are missing.
await Promise.all([
  access(resolve(ui, "index.html")),
  access(resolve(root, "example/figma-plugin/dist/plugin/main.js")),
  access(resolve(root, "example/chrome-extension/dist/manifest.json"))
]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

export const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/__e2e/health") {
    response.end("html2figma e2e");
    return;
  }
  if (pathname === "/__e2e/convert.js") {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    response.end(await readFile(resolve(root, "dist/convert.js")));
    return;
  }
  if (pathname === "/__e2e/inter-latin-400-normal.woff2") {
    response.writeHead(200, { "Content-Type": "font/woff2" });
    response.end(await readFile(resolve(root, "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2")));
    return;
  }

  const isFixture = pathname.startsWith("/__e2e/");
  const directory = isFixture ? fixtures : ui;
  let relativePath;
  try {
    relativePath = decodeURIComponent(isFixture ? pathname.slice(7) : pathname.slice(1));
  } catch {
    response.writeHead(400).end();
    return;
  }
  const filename = resolve(directory, relativePath || "index.html");
  if (!filename.startsWith(`${directory}${sep}`)) {
    response.writeHead(403).end();
    return;
  }

  try {
    const bytes = await readFile(filename);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filename)] ?? "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(bytes);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

// Match example.config.ts: the real plugin shell points to this origin.
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(5173, "localhost", resolve);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
