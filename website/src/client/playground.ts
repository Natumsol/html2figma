import { cases } from "../data/cases";
import { labels, t, type Language } from "../lib/i18n";
import { PreviewSession, downloadJson } from "../lib/preview";
import { showDiagnostics, summarize } from "../lib/diagnostics";
import { createCodeEditor } from "./code-editor";

export function initPlayground() {
  const container = document.querySelector("[data-playground]");
  if (!container) return;
  const events = new AbortController();
  const language = document.body.dataset.language as Language;
  const l = labels(language);
  const html = document.querySelector<HTMLTextAreaElement>("#html-input")!;
  const css = document.querySelector<HTMLTextAreaElement>("#css-input")!;
  const select = document.querySelector<HTMLSelectElement>("#case-select")!;
  const viewport = document.querySelector<HTMLSelectElement>("#viewport")!;
  const frame = document.querySelector<HTMLIFrameElement>("#preview-frame")!;
  const convert = document.querySelector<HTMLButtonElement>("#convert")!;
  const copy = document.querySelector<HTMLButtonElement>("#copy-json")!;
  const download = document.querySelector<HTMLButtonElement>("#download-json")!;
  const output = document.querySelector<HTMLTextAreaElement>("#json-output")!;
  const warnings = document.querySelector<HTMLElement>("#warnings-output")!;
  const status = document.querySelector<HTMLElement>("#playground-status")!;
  const statusBar = document.querySelector<HTMLElement>(".workbench-status")!;
  const summary = document.querySelector<HTMLElement>("#result-summary")!;
  const count = document.querySelector<HTMLElement>("#warning-count")!;
  let session: PreviewSession | undefined;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout>;
  const htmlEditor = createCodeEditor(html, "html", changed);
  const cssEditor = createCodeEditor(css, "css", changed);
  const jsonEditor = createCodeEditor(output, "json");
  const refresh = () => {
    htmlEditor.refresh();
    cssEditor.refresh();
    jsonEditor.refresh();
  };
  window.addEventListener("h2f:refresh-editors", refresh, {
    signal: events.signal,
  });

  function setStatus(state: string, message: string) {
    statusBar.dataset.state = state;
    status.textContent = message;
  }
  function invalidate() {
    revision++;
    copy.disabled = download.disabled = convert.disabled = true;
    jsonEditor.setValue("");
    summary.textContent = "";
    count.hidden = true;
    copy.textContent = l.copy;
    setStatus("stale", l.stale);
    showDiagnostics(
      warnings,
      [],
      [],
      language,
      t(
        language,
        "Convert your source to inspect notes here.",
        "转换源码后，在这里查看诊断说明。",
      ),
    );
    session?.destroy();
    session = undefined;
  }
  function changed() {
    invalidate();
    clearTimeout(timer);
    timer = setTimeout(() => void preview(), 350);
  }
  async function preview() {
    clearTimeout(timer);
    const current = revision;
    if (
      new Blob([html.value]).size > 200000 ||
      new Blob([css.value]).size > 200000
    ) {
      setStatus(
        "error",
        t(
          language,
          "An input exceeds the 200 KB limit.",
          "单项输入超过 200 KB 限制。",
        ),
      );
      return;
    }
    setStatus("loading", l.loading);
    session = new PreviewSession(
      frame,
      html.value,
      css.value,
      Number(viewport.value),
    );
    try {
      const resourceWarnings = await session.ready;
      if (current !== revision) return;
      setStatus(
        resourceWarnings.length ? "warning" : "ready",
        resourceWarnings.length
          ? t(
              language,
              "Preview loaded with resource issues. Inspect Diagnostics.",
              "预览已加载，部分资源异常，请查看诊断。",
            )
          : l.ready,
      );
      showDiagnostics(
        warnings,
        [],
        resourceWarnings,
        language,
        t(
          language,
          "Preview is ready. Convert to check supported styles and fallbacks.",
          "预览已就绪，转换后检查样式支持与回退行为。",
        ),
      );
      count.hidden = resourceWarnings.length === 0;
      count.textContent = String(resourceWarnings.length);
      convert.disabled = false;
    } catch (error) {
      if (current === revision)
        setStatus(
          "error",
          `${l.failed} ${error instanceof Error ? error.message : ""}`,
        );
    }
  }
  function loadCase() {
    const item = cases.find((item) => item.id === select.value) || cases[0]!;
    htmlEditor.setValue(item.html);
    cssEditor.setValue(item.css);
    invalidate();
    void preview();
  }
  const requested = new URLSearchParams(location.search).get("case");
  if (cases.some((item) => item.id === requested)) select.value = requested!;
  select.addEventListener("change", loadCase);
  viewport.addEventListener("change", () => {
    invalidate();
    void preview();
  });
  convert.addEventListener("click", async () => {
    if (!session) return;
    const current = revision;
    convert.disabled = copy.disabled = download.disabled = true;
    setStatus("loading", l.converting);
    try {
      const result = await session.convert();
      if (current !== revision) return;
      jsonEditor.setValue(JSON.stringify(result.document, null, 2));
      const total = result.document.warnings.length + result.warnings.length;
      showDiagnostics(
        warnings,
        result.document.warnings,
        result.warnings,
        language,
      );
      count.hidden = total === 0;
      count.textContent = String(total);
      const captured = summarize(result.document);
      summary.textContent = t(
        language,
        `${captured.nodes} nodes · ${captured.text} text · ${captured.width} × ${captured.height}`,
        `${captured.nodes} 个节点 · ${captured.text} 段文本 · ${captured.width} × ${captured.height}`,
      );
      setStatus(
        total ? "warning" : "success",
        total
          ? t(
              language,
              `JSON ready · ${total} notes to inspect`,
              `JSON 已生成 · ${total} 条说明待检查`,
            )
          : t(
              language,
              "JSON ready · no conversion warnings",
              "JSON 已生成 · 无转换警告",
            ),
      );
      copy.disabled = download.disabled = false;
      window.dispatchEvent(new Event("h2f:converted"));
    } catch (error) {
      if (current === revision) {
        const message = error instanceof Error ? error.message : l.failed;
        setStatus("error", message);
        showDiagnostics(warnings, [], [], language, message);
      }
    } finally {
      if (current === revision) convert.disabled = false;
    }
  });
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(output.value);
      copy.textContent = l.copied;
      setTimeout(() => {
        copy.textContent = l.copy;
      }, 2000);
    } catch {
      setStatus("error", l.clipboard);
    }
  });
  download.addEventListener("click", () =>
    downloadJson(output.value, "html2figma.json"),
  );
  loadCase();
  return () => {
    revision++;
    clearTimeout(timer);
    events.abort();
    session?.destroy();
    htmlEditor.destroy();
    cssEditor.destroy();
    jsonEditor.destroy();
  };
}
