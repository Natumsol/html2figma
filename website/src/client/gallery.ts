import { cases } from "../data/cases";
import { labels, t, type Language } from "../lib/i18n";
import { PreviewSession } from "../lib/preview";
import { showDiagnostics } from "../lib/diagnostics";
export function initGallery() {
  const language = document.body.dataset.language as Language;
  const l = labels(language);
  const sessions: PreviewSession[] = [];
  const observers: ResizeObserver[] = [];
  for (const card of document.querySelectorAll<HTMLElement>("[data-case]")) {
    const item = cases.find((item) => item.id === card.dataset.case);
    const frame = card.querySelector<HTMLIFrameElement>("iframe");
    const button = card.querySelector<HTMLButtonElement>("[data-copy]");
    const status = card.querySelector<HTMLElement>("[data-status]");
    if (!item || !frame || !button || !status) continue;
    const session = new PreviewSession(frame, item.html, item.css, item.width);
    sessions.push(session);
    const preview = frame.parentElement!;
    const fitPreview = () => {
      const scale = Math.min(
        0.86,
        Math.max(0.2, (preview.clientWidth - 20) / item.width),
      );
      frame.style.transform = `scale(${scale})`;
      preview.style.height = `${Math.ceil((parseFloat(frame.style.height) || 500) * scale + 64)}px`;
    };
    const observer = new ResizeObserver(fitPreview);
    observer.observe(preview);
    observers.push(observer);
    let json = "";
    void session
      .convert()
      .then((result) => {
        fitPreview();
        json = JSON.stringify(result.document, null, 2);
        button.disabled = false;
        const total = result.document.warnings.length + result.warnings.length;
        status.textContent = total
          ? t(
              language,
              "JSON validated · review conversion notes below",
              "JSON 校验通过 · 请查看下方转换说明",
            )
          : t(
              language,
              "JSON validated · no conversion warnings",
              "JSON 校验通过 · 无转换警告",
            );
        status.dataset.state = total ? "warning" : "success";
        const details = card.querySelector<HTMLElement>(
          ".gallery-diagnostics",
        )!;
        details.hidden = total === 0;
        card.querySelector("[data-diagnostics-label]")!.textContent = t(
          language,
          `${total} conversion notes · view details`,
          `${total} 条转换说明 · 查看详情`,
        );
        showDiagnostics(
          card.querySelector<HTMLElement>("[data-diagnostics]")!,
          result.document.warnings,
          result.warnings,
          language,
        );
      })
      .catch((error) => {
        status.textContent = `${l.failed} ${error.message}`;
      });
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(json);
        button.textContent = l.copied;
        setTimeout(() => {
          button.textContent = l.copy;
        }, 2000);
      } catch {
        status.textContent =
          document.body.dataset.language === "en"
            ? "Clipboard unavailable. Open this case in Playground to download JSON."
            : "剪贴板不可用，请在 Playground 中打开此案例并下载 JSON。";
      }
    });
  }
  return () => {
    sessions.forEach((session) => session.destroy());
    observers.forEach((observer) => observer.disconnect());
  };
}
