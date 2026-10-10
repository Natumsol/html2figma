import type { ConvertWarning, Html2FigmaDocument } from "html2figma";
import type { Language } from "./i18n";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Diagnostics } from "../components/site/Diagnostics";

export function summarize(document: Html2FigmaDocument) {
  let nodes = 0;
  let text = 0;
  const pending = [document.root];
  while (pending.length) {
    const node = pending.pop()!;
    nodes++;
    if (node.type === "text") text++;
    pending.push(...node.children);
  }
  return {
    nodes,
    text,
    resources: document.resources.length,
    width: Math.round(document.root.bounds.width),
    height: Math.round(document.root.bounds.height),
  };
}

const roots = new WeakMap<HTMLElement, Root>();
export function showDiagnostics(
  target: HTMLElement,
  warnings: ConvertWarning[],
  resources: string[],
  language: Language,
  empty?: string,
) {
  let root = roots.get(target);
  if (!root) {
    root = createRoot(target);
    roots.set(target, root);
  }
  root.render(
    createElement(Diagnostics, { warnings, resources, language, empty }),
  );
}
