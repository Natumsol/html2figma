import type { AstBounds, AstFlexLayout } from "../schema/types";
import { parseOptionalPx } from "../utils/length";

export function readBounds(element: Element): AstBounds {
  const rect = element.getBoundingClientRect();

  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

function mapJustifyContent(
  value: string
): AstFlexLayout["primaryAxisAlignItems"] {
  switch (value) {
    case "center":
      return "center";
    case "flex-end":
    case "end":
    case "right":
      return "max";
    case "space-between":
      return "space-between";
    default:
      return "min";
  }
}

function mapAlignItems(value: string): AstFlexLayout["counterAxisAlignItems"] {
  switch (value) {
    case "center":
      return "center";
    case "flex-end":
    case "end":
      return "max";
    default:
      return "min";
  }
}

export function readFlexLayout(style: CSSStyleDeclaration): AstFlexLayout | undefined {
  if (style.display !== "flex" && style.display !== "inline-flex") {
    return undefined;
  }

  return {
    mode: style.flexDirection.startsWith("row") ? "horizontal" : "vertical",
    gap: parseOptionalPx(style.gap, 0),
    padding: {
      // Figma padding is measured from the frame edge; CSS content starts
      // inside both padding and border, including transparent borders.
      top: parseOptionalPx(style.paddingTop, 0) + parseOptionalPx(style.borderTopWidth, 0),
      right: parseOptionalPx(style.paddingRight, 0) + parseOptionalPx(style.borderRightWidth, 0),
      bottom: parseOptionalPx(style.paddingBottom, 0) + parseOptionalPx(style.borderBottomWidth, 0),
      left: parseOptionalPx(style.paddingLeft, 0) + parseOptionalPx(style.borderLeftWidth, 0)
    },
    primaryAxisAlignItems: mapJustifyContent(style.justifyContent),
    counterAxisAlignItems: mapAlignItems(style.alignItems),
    wraps: style.flexWrap !== "nowrap"
  };
}
