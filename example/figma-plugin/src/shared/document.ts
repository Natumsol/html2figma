import type { Html2FigmaDocument } from "html2figma";

export interface DocumentSummary {
  version: Html2FigmaDocument["version"];
  rootName: string;
  rootType: Html2FigmaDocument["root"]["type"];
  nodeCount: number;
  resourceCount: number;
  warningCount: number;
  viewport: string;
}

export function parseDocumentJson(value: string): Html2FigmaDocument {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("JSON could not be parsed.");
  }

  if (!isHtml2FigmaDocument(parsed)) {
    throw new Error("JSON is not a valid html2figma document.");
  }

  return parsed;
}

export function isHtml2FigmaDocument(
  value: unknown
): value is Html2FigmaDocument {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 1 &&
    isHtml2FigmaNode(value.root) &&
    Array.isArray(value.resources) &&
    Array.isArray(value.warnings) &&
    isMetadata(value.metadata)
  );
}

export function summarizeDocument(
  document: Html2FigmaDocument
): DocumentSummary {
  return {
    version: document.version,
    rootName: document.root.name,
    rootType: document.root.type,
    nodeCount: countNodes(document.root),
    resourceCount: document.resources.length,
    warningCount: document.warnings.length,
    viewport: `${document.metadata.viewport.width}x${document.metadata.viewport.height}`
  };
}

function countNodes(node: Html2FigmaDocument["root"]): number {
  return 1 + node.children.reduce((count, child) => count + countNodes(child), 0);
}

function isHtml2FigmaNode(value: unknown): value is Html2FigmaDocument["root"] {
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
): value is Html2FigmaDocument["root"]["type"] {
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

function isMetadata(value: unknown): boolean {
  return (
    isRecord(value) &&
    isRecord(value.viewport) &&
    isFiniteNumber(value.viewport.width) &&
    isFiniteNumber(value.viewport.height)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
