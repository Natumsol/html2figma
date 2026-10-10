import type { Html2FigmaNode } from "html2figma";
import { cases } from "../data/cases";
import { labels, link, t, type Language } from "../lib/i18n";
import { PreviewSession } from "../lib/preview";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { LayerList } from "../components/site/LayerList";

const showcase = document.querySelector<HTMLElement>("[data-home-showcase]");
if (showcase) {
  const language = document.body.dataset.language as Language;
  const l = labels(language);
  const frame = showcase.querySelector<HTMLIFrameElement>("#home-preview")!;
  const select = showcase.querySelector<HTMLSelectElement>("#home-case")!;
  const tree = showcase.querySelector<HTMLElement>("#home-tree")!;
  const status = showcase.querySelector<HTMLElement>("#home-status")!;
  const button = showcase.querySelector<HTMLButtonElement>("#home-copy")!;
  const edit = showcase.querySelector<HTMLAnchorElement>("#home-edit")!;
  const preview = frame.parentElement!;
  const layerRoot = createRoot(tree);
  let session: PreviewSession | undefined;
  let revision = 0;
  let json = "";
  const fit = () => {
    const scale = Math.min(
      1,
      Math.max(
        0.1,
        (preview.clientWidth - 12) / (parseFloat(frame.style.width) || 640),
      ),
    );
    frame.style.transform = `scale(${scale})`;
    preview.style.height = `${Math.ceil((parseFloat(frame.style.height) || 460) * scale)}px`;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(preview);
  async function load() {
    const current = ++revision;
    session?.destroy();
    button.disabled = true;
    button.textContent = l.copy;
    status.textContent = l.loading;
    status.classList.add("sr-only");
    layerRoot.render(createElement("p", null, l.loading));
    const item = cases.find((item) => item.id === select.value)!;
    edit.href = `${link(language, "playground")}?case=${item.id}`;
    session = new PreviewSession(frame, item.html, item.css, item.width);
    try {
      const result = await session.convert();
      if (current !== revision) return;
      json = JSON.stringify(result.document, null, 2);
      const nodes: Html2FigmaNode[] = [];
      const collect = (node: Html2FigmaNode) => {
        if (
          node.type === "image" ||
          node.type === "svg" ||
          (node.type === "text" && (node.style.text?.fontSize || 0) >= 14)
        )
          nodes.push(node);
        node.children.forEach(collect);
      };
      collect(result.document.root);
      layerRoot.render(
        createElement(LayerList, {
          key: item.id,
          nodes: nodes.slice(0, 4),
          language,
          compact: true,
          onSelect: (node) => session?.highlight(node?.bounds),
        }),
      );
      const notes = result.document.warnings.length + result.warnings.length;
      status.textContent = notes
        ? t(
            language,
            `${notes} conversion notes · inspect in Playground`,
            `${notes} 条转换说明 · 在 Playground 中检查`,
          )
        : t(
            language,
            "Document validated · no conversion warnings",
            "文档校验通过 · 无转换警告",
          );
      fit();
      button.disabled = false;
    } catch (error) {
      if (current === revision) {
        status.textContent = `${l.failed} ${error instanceof Error ? error.message : ""}`;
        status.classList.remove("sr-only");
        layerRoot.render(
          createElement(
            "p",
            null,
            t(
              language,
              "Open this case in Playground to try again.",
              "请在 Playground 中打开此案例重试。",
            ),
          ),
        );
      }
    }
  }
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(json);
      button.textContent = l.copied;
      setTimeout(() => {
        button.textContent = l.copy;
      }, 2000);
    } catch {
      status.classList.remove("sr-only");
      status.textContent = t(
        language,
        "Open this case in Playground to download JSON.",
        "请在 Playground 中打开此案例并下载 JSON。",
      );
    }
  });
  select.addEventListener("change", () => void load());
  window.addEventListener("pagehide", () => {
    session?.destroy();
    observer.disconnect();
    layerRoot.unmount();
  });
  void load();
}
