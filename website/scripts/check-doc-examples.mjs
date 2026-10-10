import ts from 'typescript';
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = new URL('../', import.meta.url);
const scratch = new URL('.astro/doc-examples/', root);
await mkdir(scratch, { recursive: true });
const files = [];
try {
  for (const lang of ['en', 'zh-cn']) {
    for (const file of await readdir(new URL(`src/content/docs/${lang}/`, root))) {
      const markdown = await readFile(new URL(`src/content/docs/${lang}/${file}`, root), 'utf8');
      let index = 0;
      for (const match of markdown.matchAll(/```ts\n([\s\S]*?)```/g)) {
        const path = new URL(`${lang}-${file}-${index++}.ts`, scratch);
        await writeFile(path, match[1]);
        files.push(path.pathname);
      }
    }
  }
  const program = ts.createProgram(files, { noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, types: ['@figma/plugin-typings'], typeRoots: [resolve(root.pathname, 'node_modules/@types'), resolve(root.pathname, 'node_modules')] });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root.pathname, getCanonicalFileName: path => path, getNewLine: () => '\n' }));
    process.exitCode = 1;
  } else console.log(`Checked ${files.length} documentation TypeScript snippets against the pinned release.`);
} finally { await rm(scratch, { force: true, recursive: true }); }
