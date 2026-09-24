import { writeFile } from "node:fs/promises";
import { join } from "node:path";
export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
export async function writeReport(output: string, summary: Record<string, unknown>, basename = "report") {
  await writeFile(join(output, `${basename}.json`), JSON.stringify(summary, null, 2));
  const cases = (summary.cases ?? []) as Array<{ name: string; documentSha256: string; maxDiffPixelRatio: number;
    capture?: { mode: string; downloadedJsonSha256: string; extensionSha256: string } }>;
  const results = (summary.results ?? []) as Array<{ caseId: string; rootNodeId?: string; status: string;
    warnings?: Array<{ code: string }>; visualError?: string }>;
  const attempted = (summary.attempted ?? []) as string[];
  const failure = summary.failure as { caseId?: string; areaId?: string } | undefined;
  const cleanup = summary.cleanup as { status?: string; error?: string } | undefined;
  const target = summary.target as { fileKey?: string } | undefined;
  const rows = cases.map(entry => {
    const result = results.find(item => item.caseId === entry.name);
    const name = escapeHtml(entry.name);
    const nodeId = result?.rootNodeId ?? (failure?.caseId === entry.name ? failure.areaId : undefined);
    const link = nodeId && target?.fileKey
      ? cleanup?.status === "passed" && result?.status === "passed"
        ? `${escapeHtml(nodeId)} (cleaned)`
        : `<a href="https://www.figma.com/design/${encodeURIComponent(target.fileKey)}?node-id=${encodeURIComponent(nodeId)}">Figma node</a>` : "";
    const image = (suffix: string) => `<a href="${name}-${suffix}.png"><img src="${name}-${suffix}.png" alt="${name} ${suffix}"></a>`;
    const warnings = result?.warnings?.map(warning => warning.code).join(", ") ?? "";
    const source = entry.capture ? `Extension ${escapeHtml(entry.capture.mode)} download` : "Browser convert";
    const status = result?.status ?? (attempted.includes(entry.name)
      ? summary.status === "unknown" ? "unknown" : "failed" : "unexecuted");
    return `<tr><td>${name}</td><td>${source}</td><td>${escapeHtml(status)}</td><td>${escapeHtml(entry.documentSha256)}</td><td>${entry.maxDiffPixelRatio}</td><td>${escapeHtml(warnings)}</td><td>${image("browser")}</td><td>${result ? image("figma") : ""}</td><td>${result?.visualError ? image("diff") : ""}</td><td>${link}</td></tr>`;
  }).join("\n");
  await writeFile(join(output, `${basename}.html`), `<!doctype html><html lang="en"><meta charset="utf-8">
<title>html2figma real acceptance</title><style>body{font:16px system-ui;margin:32px}table{border-collapse:collapse}td,th{padding:8px;border:1px solid #ccc}img{width:240px;height:auto}pre{white-space:pre-wrap}</style>
<h1>${cases.length} cases: ${escapeHtml(String(summary.status))}</h1><p>Real plugin API acceptance. Cleanup: ${escapeHtml(cleanup?.status ?? "not attempted")}. Passed nodes are cleaned only after the initial report is saved; failed or unknown nodes are retained. Browser-only UI tests are separate.</p>
<table><thead><tr><th>Case</th><th>Source</th><th>Status</th><th>Document SHA-256</th><th>Max diff ratio</th><th>Warnings</th><th>Browser</th><th>Figma</th><th>Diff</th><th>Node</th></tr></thead><tbody>${rows}</tbody></table>
<pre>${escapeHtml(JSON.stringify(summary, null, 2))}</pre></html>`);
}
