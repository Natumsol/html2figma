import { build } from "esbuild";
import { zipSync, strToU8 } from "fflate";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { format } from "prettier";

const root = fileURLToPath(new URL("../", import.meta.url));
const at = (path) => resolve(root, path);
const pkg = JSON.parse(await readFile(at("package.json"), "utf8"));
const library = JSON.parse(
  await readFile(at("node_modules/html2figma/package.json"), "utf8"),
);
if (pkg.dependencies.html2figma !== library.version)
  throw new Error("Library version must be pinned exactly.");
const version = library.version;
for (const dir of [
  "public/brand",
  "public/downloads",
  "public/preview",
  "src/data/generated",
])
  await mkdir(at(dir), { recursive: true });
for (const file of ["logo.svg", "logo.png"])
  await copyFile(at(`../docs/brand/${file}`), at(`public/brand/${file}`));
await copyFile(
  at("node_modules/@fontsource/geist/LICENSE"),
  at("public/brand/GEIST-LICENSE.txt"),
);
await copyFile(
  at("node_modules/@fontsource/geist/files/geist-latin-400-normal.woff2"),
  at("public/brand/geist.woff2"),
);
await writeFile(
  at("src/data/generated/font.json"),
  JSON.stringify({
    source: `data:font/woff2;base64,${(await readFile(at("public/brand/geist.woff2"))).toString("base64")}`,
  }),
);
const names = [
  "hero-section",
  "icon-feature-card",
  "pricing-card",
  "profile-media-card",
  "image-product-card",
  "stats-panel",
];
const cases = [];
await mkdir(at(".artifacts"), { recursive: true });
await build({
  entryPoints: [at("src/data/examples/Examples.tsx")],
  outfile: at(".artifacts/examples.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  alias: { "@": at("src") },
  external: ["react", "react-dom/server", "radix-ui"],
});
const { renderExamples } = createRequire(import.meta.url)(
  at(".artifacts/examples.cjs"),
);
const examples = renderExamples();
const sharedCss = await readFile(at("src/data/examples/shared.css"), "utf8");
for (const id of names) {
  const css = [
    sharedCss,
    await readFile(at(`src/data/examples/${id}.css`), "utf8"),
  ].join("\n");
  let html = examples[id];
  for (const asset of ["portrait.png", "canvas.png"]) {
    html = html.replaceAll(
      `case-asset:${asset}`,
      `data:image/png;base64,${(await readFile(at(`src/data/examples/media/${asset}`))).toString("base64")}`,
    );
  }
  cases.push({
    id,
    html: await format(html, { parser: "html", printWidth: 90 }),
    css,
    width: 640,
  });
}
await writeFile(at("src/data/generated/cases.json"), JSON.stringify(cases));
await writeFile(
  at("src/data/generated/release.json"),
  JSON.stringify({
    version,
    plugin: `/downloads/html2figma-plugin-${version}.zip`,
  }),
);
const declarationIndex = await readFile(
  at("node_modules/html2figma/dist/index.d.ts"),
  "utf8",
);
const schemaFile = /from ['"]\.\/(types-[\w-]+)\.js['"]/.exec(
  declarationIndex,
)?.[1];
if (!schemaFile)
  throw new Error(
    "Published schema declaration file not found. Review the API documentation generator.",
  );
const declarations = (
  await readFile(at(`node_modules/html2figma/dist/${schemaFile}.d.ts`), "utf8")
).replace(/\nexport \{[\s\S]*$/, "");
await writeFile(
  at("src/data/generated/schema.json"),
  JSON.stringify({ declarations }),
);
await build({
  entryPoints: [at("src/client/preview-runner.ts")],
  outfile: at("public/preview/runner.js"),
  bundle: true,
  format: "iife",
  target: "es2022",
  minify: true,
});
const uiBundle = await build({
  entryPoints: [at("plugin/ui.ts")],
  write: false,
  bundle: true,
  format: "iife",
  target: "es2017",
  minify: true,
});
const html = (await readFile(at("plugin/ui.html"), "utf8"))
  .replace("__VERSION__", version)
  .replace(
    "__SCRIPT__",
    uiBundle.outputFiles[0].text.replaceAll("</script", "<\\/script"),
  );
const pluginBundle = await build({
  entryPoints: [at("plugin/main.ts")],
  write: false,
  bundle: true,
  format: "iife",
  target: "es2017",
  minify: true,
  define: {
    __html__: JSON.stringify(html),
    __LIBRARY_VERSION__: JSON.stringify(version),
  },
});
const manifest = {
  name: `html2figma ${version}`,
  id: "html2figma-website",
  api: "1.0.0",
  main: "main.js",
  documentAccess: "dynamic-page",
  editorType: ["figma"],
  networkAccess: {
    allowedDomains: ["*"],
    reasoning:
      "Imported JSON can reference public images. The plugin fetches these resources to create Figma layers.",
  },
};
const readme = `html2figma ${version}\n\nUnzip this folder. In Figma desktop, open a Design file and select Plugins → Development → Import plugin from manifest. Select manifest.json, run the plugin, and paste your JSON into Import JSON.\n\n解压后，在 Figma 桌面版中打开 Design 文件，通过插件 → 开发 → 从 manifest 导入插件，选择 manifest.json。运行插件并粘贴 JSON。\n\nFonts must be available in Figma; missing fonts fall back to Inter. Public images must be accessible from the plugin.\n`;
const license = `MIT License\n\nCopyright (c) html2figma contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n`;
const zip = zipSync({
  "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
  "main.js": pluginBundle.outputFiles[0].contents,
  "README.txt": strToU8(readme),
  "LICENSE.txt": strToU8(license),
});
await writeFile(at(`public/downloads/html2figma-plugin-${version}.zip`), zip);
// Unpacked build is useful for local Figma acceptance, never committed.
await mkdir(at("public/downloads/plugin"), { recursive: true });
await writeFile(
  at("public/downloads/plugin/manifest.json"),
  JSON.stringify(manifest, null, 2),
);
await writeFile(
  at("public/downloads/plugin/main.js"),
  pluginBundle.outputFiles[0].contents,
);
console.log(
  `Prepared six cases, preview runner and standalone plugin · html2figma ${version}`,
);
