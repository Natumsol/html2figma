import { writeFile } from "node:fs/promises";
import { join } from "node:path";
export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
export async function writeReport(output: string, summary: Record<string, unknown>) {
  await writeFile(join(output, "report.json"), JSON.stringify(summary, null, 2));
  const cases = (summary.cases ?? []) as Array<{ name: string; documentSha256: string; maxDiffPixelRatio: number }>;
  const results = (summary.results ?? []) as Array<{ caseId: string; rootNodeId?: string; status: string;
    warnings?: Array<{ code: string }>; visualError?: string }>;
  const target = summary.target as { fileKey?: string } | undefined;
  const rows = cases.map(entry => {
    const result = results.find(item => item.caseId === entry.name);
    const name = escapeHtml(entry.name);
    const link = result?.rootNodeId && target?.fileKey
      ? `<a href="https://www.figma.com/design/${encodeURIComponent(target.fileKey)}?node-id=${encodeURIComponent(result.rootNodeId)}">Figma node</a>` : "";
    const image = (suffix: string) => `<a href="${name}-${suffix}.png"><img src="${name}-${suffix}.png" alt="${name} ${suffix}"></a>`;
    const warnings = result?.warnings?.map(warning => warning.code).join(", ") ?? "";
    return `<tr><td>${name}</td><td>${escapeHtml(result?.status ?? "unexecuted")}</td><td>${escapeHtml(entry.documentSha256)}</td><td>${entry.maxDiffPixelRatio}</td><td>${escapeHtml(warnings)}</td><td>${image("browser")}</td><td>${result ? image("figma") : ""}</td><td>${result?.visualError ? image("diff") : ""}</td><td>${link}</td></tr>`;
  }).join("\n");
  await writeFile(join(output, "report.html"), `<!doctype html><html lang="en"><meta charset="utf-8">
<title>html2figma real six-case acceptance</title><style>body{font:16px system-ui;margin:32px}table{border-collapse:collapse}td,th{padding:8px;border:1px solid #ccc}img{width:240px;height:auto}pre{white-space:pre-wrap}</style>
<h1>Six visual cases: ${escapeHtml(String(summary.status))}</h1><p>Real plugin API acceptance. Created nodes are retained.</p>
<table><thead><tr><th>Case</th><th>Status</th><th>Document SHA-256</th><th>Max diff ratio</th><th>Warnings</th><th>Browser</th><th>Figma</th><th>Diff</th><th>Node</th></tr></thead><tbody>${rows}</tbody></table>
<pre>${escapeHtml(JSON.stringify(summary, null, 2))}</pre></html>`);
}
