import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "html2figma-consumer-"));
try {
  await mkdir(join(directory, "node_modules"));
  await symlink(root, join(directory, "node_modules/html2figma"), "dir");
  const cases = {
    schema: { lib: ["lib.es2022.d.ts"], code: 'import type { Html2FigmaDocument } from "html2figma"; declare const value: Html2FigmaDocument; JSON.stringify(value);' },
    browser: { lib: ["lib.es2022.d.ts", "lib.dom.d.ts"], code: 'import { convert } from "html2figma/convert"; convert(document.body);' },
    render: {
      lib: ["lib.es2022.d.ts"],
      ambient: [join(root, "node_modules/@figma/plugin-typings/index.d.ts")],
      code: 'import { render, type RenderOptions, type RenderResult } from "html2figma/render"; import type { Html2FigmaDocument } from "html2figma"; declare const ast: Html2FigmaDocument; const options: RenderOptions = { parent: figma.currentPage }; const result: Promise<RenderResult> = render(ast, options); result.then(value => { const node: SceneNode = value.root; node.x = 10; });'
    }
  };
  for (const [name, entry] of Object.entries(cases)) {
    const path = join(directory, `${name}.ts`);
    await writeFile(path, entry.code);
    const program = ts.createProgram([path, ...(entry.ambient ?? [])], {
      noEmit: true, strict: true, skipLibCheck: false, types: [],
      module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: entry.lib
    });
    const errors = ts.getPreEmitDiagnostics(program);
    assert.equal(errors.length, 0, `${name}: ${errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n")}`);
    console.log(`Consumer passed: ${name}`);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
