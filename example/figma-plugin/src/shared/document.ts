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
    isArrayOf(value.resources, isResource) &&
    isArrayOf(value.warnings, isWarning) &&
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
    !isStyle(value.style) ||
    !isSource(value.source) ||
    !isArrayOf(value.warnings, isWarning) ||
    !Array.isArray(value.children) ||
    !value.children.every(isHtml2FigmaNode)
  ) {
    return false;
  }

  if (value.type === "text") {
    return typeof value.text === "string";
  }

  if (value.type === "image" || value.type === "svg") {
    return (
      typeof value.resourceId === "string" &&
      (value.type !== "image" || isOptionalString(value, "alt"))
    );
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
    typeof value.createdAt === "string" &&
    isOptionalString(value, "sourceUrl") &&
    isRecord(value.viewport) &&
    isFiniteNumber(value.viewport.width) &&
    isFiniteNumber(value.viewport.height)
  );
}

function isResource(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.type === "image" || value.type === "svg") &&
    typeof value.source === "string" &&
    isOptionalString(value, "data") &&
    isOptionalString(value, "mimeType")
  );
}

function isWarning(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    isWarningSeverity(value.severity) &&
    isOptionalString(value, "nodeId") &&
    isOptionalString(value, "cssProperty") &&
    isOptionalString(value, "source")
  );
}

function isWarningSeverity(value: unknown): boolean {
  return value === "info" || value === "warning" || value === "error";
}

function isStyle(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOptionalFiniteNumber(value, "opacity") &&
    isOptionalArrayOf(value, "fills", isFill) &&
    isOptionalArrayOf(value, "strokes", isStroke) &&
    isOptional(value.cornerRadius, isCornerRadius) &&
    isOptionalArrayOf(value, "effects", isShadow) &&
    isOptional(value.text, isTextStyle) &&
    isOptional(value.layout, isFlexLayout)
  );
}

function isFill(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type === "solid") {
    return isRgb(value.color) && isFiniteNumber(value.opacity);
  }

  if (value.type === "image") {
    return (
      typeof value.resourceId === "string" &&
      isFiniteNumber(value.opacity) &&
      isImageScaleMode(value.scaleMode)
    );
  }

  return false;
}

function isImageScaleMode(value: unknown): boolean {
  return value === "fill" || value === "fit" || value === "crop" || value === "tile";
}

function isStroke(value: unknown): boolean {
  return (
    isRecord(value) &&
    isRgb(value.color) &&
    isFiniteNumber(value.opacity) &&
    isFiniteNumber(value.weight) &&
    isStrokeAlign(value.align)
  );
}

function isStrokeAlign(value: unknown): boolean {
  return value === "inside" || value === "center" || value === "outside";
}

function isCornerRadius(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.topLeft) &&
    isFiniteNumber(value.topRight) &&
    isFiniteNumber(value.bottomRight) &&
    isFiniteNumber(value.bottomLeft)
  );
}

function isShadow(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.type === "drop-shadow" &&
    isRgb(value.color) &&
    isFiniteNumber(value.opacity) &&
    isFiniteNumber(value.offsetX) &&
    isFiniteNumber(value.offsetY) &&
    isFiniteNumber(value.blur) &&
    isFiniteNumber(value.spread)
  );
}

function isTextStyle(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.fontFamily === "string" &&
    isFiniteNumber(value.fontSize) &&
    isFiniteNumber(value.fontWeight) &&
    isOptional(value.fontStyle, isFontStyle) &&
    isOptionalFiniteNumber(value, "lineHeight") &&
    isOptionalFiniteNumber(value, "letterSpacing") &&
    isOptional(value.textAlign, isTextAlign) &&
    isOptional(value.textDecoration, isTextDecoration) &&
    isOptional(value.color, isRgb)
  );
}

function isFontStyle(value: unknown): boolean {
  return value === "normal" || value === "italic";
}

function isTextAlign(value: unknown): boolean {
  return (
    value === "left" ||
    value === "center" ||
    value === "right" ||
    value === "justified"
  );
}

function isTextDecoration(value: unknown): boolean {
  return (
    value === "none" || value === "underline" || value === "strikethrough"
  );
}

function isFlexLayout(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.mode === "horizontal" || value.mode === "vertical") &&
    isFiniteNumber(value.gap) &&
    isPadding(value.padding) &&
    isPrimaryAxisAlignItems(value.primaryAxisAlignItems) &&
    isCounterAxisAlignItems(value.counterAxisAlignItems) &&
    typeof value.wraps === "boolean"
  );
}

function isPadding(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.top) &&
    isFiniteNumber(value.right) &&
    isFiniteNumber(value.bottom) &&
    isFiniteNumber(value.left)
  );
}

function isPrimaryAxisAlignItems(value: unknown): boolean {
  return (
    value === "min" ||
    value === "center" ||
    value === "max" ||
    value === "space-between"
  );
}

function isCounterAxisAlignItems(value: unknown): boolean {
  return value === "min" || value === "center" || value === "max";
}

function isRgb(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.r) &&
    isFiniteNumber(value.g) &&
    isFiniteNumber(value.b)
  );
}

function isOptional(
  value: unknown,
  predicate: (value: unknown) => boolean
): boolean {
  return value === undefined || predicate(value);
}

function isOptionalString(
  value: Record<string, unknown>,
  key: string
): boolean {
  return value[key] === undefined || typeof value[key] === "string";
}

function isOptionalFiniteNumber(
  value: Record<string, unknown>,
  key: string
): boolean {
  return value[key] === undefined || isFiniteNumber(value[key]);
}

function isOptionalArrayOf(
  value: Record<string, unknown>,
  key: string,
  predicate: (item: unknown) => boolean
): boolean {
  return value[key] === undefined || isArrayOf(value[key], predicate);
}

function isArrayOf(
  value: unknown,
  predicate: (item: unknown) => boolean
): boolean {
  return Array.isArray(value) && value.every(predicate);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
