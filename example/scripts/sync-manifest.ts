import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import exampleConfig from "../example.config";

const currentDir = dirname(fileURLToPath(import.meta.url));
const exampleRoot = resolve(currentDir, "..");
const manifestPath = resolve(exampleRoot, "manifest.json");

interface FigmaManifest {
  name: string;
  id: string;
  api: "1.0.0";
  main: string;
  documentAccess: "dynamic-page";
  editorType: ["figma"];
  networkAccess: {
    allowedDomains: ["none"];
    devAllowedDomains: string[];
  };
}

async function main(): Promise<void> {
  const manifest: FigmaManifest = {
    name: exampleConfig.pluginName,
    id: exampleConfig.pluginId,
    api: "1.0.0",
    main: "dist/plugin/main.js",
    documentAccess: "dynamic-page",
    editorType: ["figma"],
    networkAccess: {
      allowedDomains: ["none"],
      devAllowedDomains: [new URL(exampleConfig.uiDevUrl).origin]
    }
  };

  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
