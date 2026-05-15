import type {
  AstStroke,
  AstStyle,
  AstTextStyle,
  ConvertWarning,
  NodeId,
  ResourceRef
} from "../schema/types";
import { imageMimeType, parseBackgroundImage } from "../utils/background";
import { parseCssColor } from "../utils/color";
import { firstFontFamily, normalizeFontWeight } from "../utils/font";
import { parseOptionalPx } from "../utils/length";
import { parseBoxShadow } from "../utils/shadow";
import { createWarning } from "../utils/warnings";
import type { BorderPaint, BorderSide } from "./borders";
import { readFlexLayout } from "./layout";

export function readStyle(
  element: Element,
  nodeId: NodeId,
  resources: ResourceRef[]
): { style: AstStyle; warnings: ConvertWarning[]; borderSides: BorderPaint[] } {
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

  const backgroundImage = parseBackgroundImage(computedStyle.backgroundImage);
  if (backgroundImage.kind === "url") {
    const resourceId = `resource-${resources.length + 1}`;
    resources.push({
      id: resourceId,
      type: "image",
      source: backgroundImage.url,
      mimeType: imageMimeType(backgroundImage.url)
    });
    style.fills = [
      ...(style.fills ?? []),
      {
        type: "image",
        resourceId,
        opacity: 1,
        scaleMode: computedStyle.backgroundSize === "contain" ? "fit" : "fill"
      }
    ];
  } else if (backgroundImage.kind === "unsupported") {
    warnings.push(
      createWarning(
        "unsupported-background-image",
        "CSS background image is not supported",
        "warning",
        {
          nodeId,
          cssProperty: "background-image",
          source: computedStyle.backgroundImage
        }
      )
    );
  }

  const borderSides = readBorderSides(computedStyle, nodeId, warnings);
  const uniformStroke = readUniformBorderStroke(borderSides);
  if (uniformStroke) {
    style.strokes = [uniformStroke];
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

  return {
    style,
    warnings,
    borderSides: style.strokes ? [] : borderSides
  };
}

function readBorderSides(
  style: CSSStyleDeclaration,
  nodeId: NodeId,
  warnings: ConvertWarning[]
): BorderPaint[] {
  return BORDER_SIDES
    .map((side) => readBorderSide(style, side, nodeId, warnings))
    .filter((side): side is BorderPaint => Boolean(side));
}

function readBorderSide(
  style: CSSStyleDeclaration,
  side: BorderSide,
  nodeId: NodeId,
  warnings: ConvertWarning[]
): BorderPaint | undefined {
  const weight = parseOptionalPx(readBorderSideProperty(style, side, "Width"), 0);
  const borderStyle = readBorderSideProperty(style, side, "Style");
  if (weight <= 0 || borderStyle === "none" || borderStyle === "hidden") {
    return undefined;
  }

  const color = parseCssColor(readBorderSideProperty(style, side, "Color"));
  if (!color) {
    return undefined;
  }

  if (borderStyle !== "solid") {
    warnings.push(
      createWarning(
        "unsupported-border-style",
        "Only solid CSS border styles are supported",
        "warning",
        {
          nodeId,
          cssProperty: `border-${side}-style`,
          source: borderStyle
        }
      )
    );
    return undefined;
  }

  return {
    side,
    color: color.color,
    opacity: color.opacity,
    weight
  };
}

function readBorderSideProperty(
  style: CSSStyleDeclaration,
  side: BorderSide,
  property: "Width" | "Style" | "Color"
): string {
  return style[`border${capitalize(side)}${property}` as keyof CSSStyleDeclaration] as string;
}

function readUniformBorderStroke(borderSides: BorderPaint[]): AstStroke | undefined {
  if (borderSides.length !== BORDER_SIDES.length) {
    return undefined;
  }

  const [first, ...rest] = borderSides;
  if (!first || !rest.every((side) => equalBorderPaint(side, first))) {
    return undefined;
  }

  return borderPaintToStroke(first);
}

function equalBorderPaint(a: BorderPaint, b: BorderPaint): boolean {
  return (
    a.weight === b.weight &&
    a.opacity === b.opacity &&
    a.color.r === b.color.r &&
    a.color.g === b.color.g &&
    a.color.b === b.color.b
  );
}

function borderPaintToStroke(border: BorderPaint): AstStroke {
  return {
    color: border.color,
    opacity: border.opacity,
    weight: border.weight,
    align: "inside"
  };
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function readTextStyle(style: CSSStyleDeclaration): AstTextStyle {
  const color = parseCssColor(style.color);
  const textStyle: AstTextStyle = {
    fontFamily: firstFontFamily(style.fontFamily),
    fontSize: parseOptionalPx(style.fontSize, 0),
    fontWeight: normalizeFontWeight(style.fontWeight)
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
  textStyle.textCase = mapTextTransform(style.textTransform);

  if (color) {
    textStyle.color = color.color;
  }

  return textStyle;
}

const BORDER_SIDES: BorderSide[] = ["top", "right", "bottom", "left"];

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

function mapTextTransform(value: string): AstTextStyle["textCase"] | undefined {
  switch (value) {
    case "uppercase":
      return "upper";
    case "lowercase":
      return "lower";
    case "capitalize":
      return "title";
    default:
      return undefined;
  }
}
