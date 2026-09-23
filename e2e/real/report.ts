import { writeFile } from "node:fs/promises";
import { join } from "node:path";
export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
export async function writeReport(output: string, summary: Record<string, unknown>) {
  await writeFile(join(output, "report.json"), JSON.stringify(summary, null, 2));
  const result = summary.result as { rootNodeId?: string } | undefined;
  const target = summary.target as { fileKey?: string } | undefined;
  const link = result?.rootNodeId && target?.fileKey
    ? `<a href="https://www.figma.com/design/${encodeURIComponent(target.fileKey)}?node-id=${encodeURIComponent(result.rootNodeId)}">Figma node</a>` : "";
  await writeFile(join(output, "report.html"), `<!doctype html><html lang="en"><meta charset="utf-8">
<title>html2figma real geometry acceptance</title><style>body{font:16px system-ui;margin:32px;max-width:1000px}pre{white-space:pre-wrap}figure{display:inline-block;margin:12px}img{max-width:100%}</style>
<h1>Geometry: ${escapeHtml(String(summary.status))}</h1><p>Real plugin API acceptance. Desktop UI controls are not covered. Created nodes are retained.</p>${link}
<figure><figcaption>Browser</figcaption><img src="geometry-browser.png"></figure>
${summary.result ? '<figure><figcaption>Figma</figcaption><img src="geometry-figma.png"></figure>' : ""}
${summary.visualError ? '<figure><figcaption>Diff</figcaption><img src="geometry-diff.png"></figure>' : ""}
<pre>${escapeHtml(JSON.stringify(summary, null, 2))}</pre></html>`);
}
