import type { Html2FigmaDocument, Html2FigmaNode } from "./types";

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
    isMetadata(value.metadata) &&
    hasValidReferences(value as unknown as Html2FigmaDocument)
  );
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
    isNonNegative(value.width) &&
    isNonNegative(value.height)
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
    isNonNegative(value.viewport.width) &&
    isNonNegative(value.viewport.height)
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
    isOptional(value.opacity, isOpacity) &&
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
    return isRgb(value.color) && isOpacity(value.opacity);
  }

  if (value.type === "image") {
    return (
      typeof value.resourceId === "string" &&
      isOpacity(value.opacity) &&
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
    isOpacity(value.opacity) &&
    isNonNegative(value.weight) &&
    isStrokeAlign(value.align)
  );
}

function isStrokeAlign(value: unknown): boolean {
  return value === "inside" || value === "center" || value === "outside";
}

function isCornerRadius(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonNegative(value.topLeft) &&
    isNonNegative(value.topRight) &&
    isNonNegative(value.bottomRight) &&
    isNonNegative(value.bottomLeft)
  );
}

function isShadow(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.type === "drop-shadow" &&
    isRgb(value.color) &&
    isOpacity(value.opacity) &&
    isFiniteNumber(value.offsetX) &&
    isFiniteNumber(value.offsetY) &&
    isNonNegative(value.blur) &&
    isFiniteNumber(value.spread)
  );
}

function isTextStyle(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.fontFamily === "string" &&
    isNonNegative(value.fontSize) &&
    isNumberInRange(value.fontWeight, 1, 1000) &&
    isOptional(value.fontStyle, isFontStyle) &&
    isOptional(value.lineHeight, isNonNegative) &&
    isOptionalFiniteNumber(value, "letterSpacing") &&
    isOptional(value.textAlign, isTextAlign) &&
    isOptional(value.textDecoration, isTextDecoration) &&
    isOptional(value.textCase, isTextCase) &&
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
    isNonNegative(value.top) &&
    isNonNegative(value.right) &&
    isNonNegative(value.bottom) &&
    isNonNegative(value.left)
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
    isNumberInRange(value.r, 0, 255) &&
    isNumberInRange(value.g, 0, 255) &&
    isNumberInRange(value.b, 0, 255)
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

function isNonNegative(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isNumberInRange(value: unknown, min: number, max: number): boolean {
  return isFiniteNumber(value) && value >= min && value <= max;
}

function isOpacity(value: unknown): boolean {
  return isNumberInRange(value, 0, 1);
}

function isTextCase(value: unknown): boolean {
  return value === "upper" || value === "lower" || value === "title";
}

function hasValidReferences(document: Html2FigmaDocument): boolean {
  const resources = new Map(document.resources.map(resource => [resource.id, resource]));
  if (resources.size !== document.resources.length) return false;
  const ids = new Set<string>();
  const pending: Html2FigmaNode[] = [document.root];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (ids.has(node.id)) return false;
    ids.add(node.id);
    if ((node.type === "image" || node.type === "svg") && resources.get(node.resourceId)?.type !== node.type) {
      return false;
    }
    if (node.style.fills?.some(fill => fill.type === "image" && resources.get(fill.resourceId)?.type !== "image")) {
      return false;
    }
    pending.push(...node.children);
  }
  return true;
}
