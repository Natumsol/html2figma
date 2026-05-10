import type { AstStroke, AstStyle, AstTextStyle, ConvertWarning, NodeId } from "../schema/types";
import { parseCssColor } from "../utils/color";
import { parseOptionalPx } from "../utils/length";
import { parseBoxShadow } from "../utils/shadow";
import { createWarning } from "../utils/warnings";
import { readFlexLayout } from "./layout";

export function readStyle(
  element: Element,
  nodeId: NodeId
): { style: AstStyle; warnings: ConvertWarning[] } {
  const computedStyle = window.getComputedStyle(element);
  const style: AstStyle = {};
  const warnings: ConvertWarning[] = [];

  const background = parseCssColor(computedStyle.backgroundColor);
  if (background) {
    style.fills = [
      {
        type: "solid",
        color: background.color,
        opacity: background.opacity
      }
    ];
  }

  const stroke = readTopBorder(computedStyle);
  if (stroke) {
    style.strokes = [stroke];
  }

  style.cornerRadius = {
    topLeft: parseOptionalPx(computedStyle.borderTopLeftRadius, 0),
    topRight: parseOptionalPx(computedStyle.borderTopRightRadius, 0),
    bottomRight: parseOptionalPx(computedStyle.borderBottomRightRadius, 0),
    bottomLeft: parseOptionalPx(computedStyle.borderBottomLeftRadius, 0)
  };

  const opacity = Number(computedStyle.opacity);
  if (Number.isFinite(opacity) && opacity < 1) {
    style.opacity = opacity;
  }

  const effects = parseBoxShadow(computedStyle.boxShadow);
  if (effects.length > 0) {
    style.effects = effects;
  }

  style.text = readTextStyle(computedStyle);

  const layout = readFlexLayout(computedStyle);
  if (layout) {
    style.layout = layout;
  }

  if (computedStyle.display === "grid" || computedStyle.display === "inline-grid") {
    warnings.push(
      createWarning("unsupported-css-grid", "CSS grid layout is not supported", "warning", {
        nodeId,
        cssProperty: "display",
        source: computedStyle.display
      })
    );
  }

  if (computedStyle.transform !== "none") {
    warnings.push(
      createWarning("unsupported-transform", "CSS transforms are not supported", "warning", {
        nodeId,
        cssProperty: "transform",
        source: computedStyle.transform
      })
    );
  }

  return { style, warnings };
}

function readTopBorder(style: CSSStyleDeclaration): AstStroke | undefined {
  if (style.borderTopStyle !== "solid") {
    return undefined;
  }

  const color = parseCssColor(style.borderTopColor);
  const weight = parseOptionalPx(style.borderTopWidth, 0);
  if (!color || weight <= 0) {
    return undefined;
  }

  return {
    color: color.color,
    opacity: color.opacity,
    weight,
    align: "inside"
  };
}

function readTextStyle(style: CSSStyleDeclaration): AstTextStyle {
  const color = parseCssColor(style.color);
  const textStyle: AstTextStyle = {
    fontFamily: style.fontFamily,
    fontSize: parseOptionalPx(style.fontSize, 0),
    fontWeight: parseFontWeight(style.fontWeight)
  };

  if (style.fontStyle === "italic") {
    textStyle.fontStyle = "italic";
  } else if (style.fontStyle === "normal") {
    textStyle.fontStyle = "normal";
  }

  const lineHeight = parseOptionalPx(style.lineHeight, Number.NaN);
  if (Number.isFinite(lineHeight)) {
    textStyle.lineHeight = lineHeight;
  }

  const letterSpacing = parseOptionalPx(style.letterSpacing, Number.NaN);
  if (Number.isFinite(letterSpacing)) {
    textStyle.letterSpacing = letterSpacing;
  }

  textStyle.textAlign = mapTextAlign(style.textAlign);
  textStyle.textDecoration = mapTextDecoration(style.textDecorationLine);

  if (color) {
    textStyle.color = color.color;
  }

  return textStyle;
}

function parseFontWeight(value: string): number {
  const namedWeights: Record<string, number> = {
    normal: 400,
    bold: 700
  };

  const numericWeight = Number(value);
  return namedWeights[value] ?? (Number.isFinite(numericWeight) ? numericWeight : 400);
}

function mapTextAlign(value: string): AstTextStyle["textAlign"] {
  switch (value) {
    case "center":
    case "right":
      return value;
    case "justify":
      return "justified";
    default:
      return "left";
  }
}

function mapTextDecoration(value: string): AstTextStyle["textDecoration"] {
  if (value.includes("line-through")) {
    return "strikethrough";
  }

  if (value.includes("underline")) {
    return "underline";
  }

  return "none";
}
