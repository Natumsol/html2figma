import type { Html2FigmaDocument } from "html2figma";

export interface RenderBlockMessage {
  type: "render-block";
  blockId: string;
  document: Html2FigmaDocument;
}

export type UiToPluginMessage = RenderBlockMessage;

export function isUiToPluginMessage(value: unknown): value is UiToPluginMessage {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type === "render-block" &&
    typeof value.blockId === "string" &&
    isHtml2FigmaDocument(value.document)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isHtml2FigmaDocument(value: unknown): value is Html2FigmaDocument {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 1 &&
    isHtml2FigmaNode(value.root) &&
    Array.isArray(value.resources) &&
    Array.isArray(value.warnings) &&
    isRecord(value.metadata)
  );
}

function isHtml2FigmaNode(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isHtml2FigmaNodeType(value.type) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !isBounds(value.bounds) ||
    !isRecord(value.style) ||
    !isSource(value.source) ||
    !Array.isArray(value.warnings) ||
    !Array.isArray(value.children) ||
    !value.children.every(isHtml2FigmaNode)
  ) {
    return false;
  }

  if (value.type === "text") {
    return typeof value.text === "string";
  }

  if (value.type === "image" || value.type === "svg") {
    return typeof value.resourceId === "string";
  }

  return true;
}

function isHtml2FigmaNodeType(
  value: unknown
): value is "frame" | "text" | "rectangle" | "image" | "svg" {
  return (
    value === "frame" ||
    value === "text" ||
    value === "rectangle" ||
    value === "image" ||
    value === "svg"
  );
}

function isBounds(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height)
  );
}

function isSource(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.tagName === "string" &&
    typeof value.path === "string"
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
