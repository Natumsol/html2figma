import { useState } from "react";
import type { Html2FigmaNode } from "html2figma";
import { Button } from "../ui/button";
import { t, type Language } from "@/lib/i18n";

export function LayerList({
  nodes,
  language,
  onSelect,
  compact = false,
  selectedId,
}: {
  nodes: Html2FigmaNode[];
  language: Language;
  onSelect: (node: Html2FigmaNode | undefined) => void;
  compact?: boolean;
  selectedId?: string | null;
}) {
  const [selected, setSelected] = useState<string>();
  const active = selectedId === undefined ? selected : selectedId;
  return (
    <div
      className="layer-list"
      role="group"
      aria-label={t(language, "Select a captured layer", "选择已捕获的图层")}
    >
      {nodes.map((node) => (
        <Button
          key={node.id}
          variant="ghost"
          className="tree-row h-auto w-full min-w-0 justify-start rounded-lg px-3 py-2 text-left font-normal shadow-none"
          aria-pressed={active === node.id}
          onClick={() => {
            const next = active === node.id ? undefined : node.id;
            setSelected(next);
            onSelect(next ? node : undefined);
          }}
        >
          <span className="layer-icon" data-kind={node.type} aria-hidden="true">
            {node.type === "text" ? "T" : node.type === "image" ? "▧" : "◇"}
          </span>
          <span className="tree-name">
            {node.type === "text"
              ? node.text
              : node.type === "image"
                ? node.alt || t(language, "Image", "图片")
                : t(language, "Vector", "矢量")}
          </span>
          {!compact && (
            <small>
              {node.type === "text"
                ? `${Math.round(node.style.text?.fontSize || 0)}px`
                : node.type.toUpperCase()}
            </small>
          )}
        </Button>
      ))}
    </div>
  );
}
