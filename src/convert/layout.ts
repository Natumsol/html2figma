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

export function readFlexLayout(element: Element, style: CSSStyleDeclaration): AstFlexLayout | undefined {
  if (style.display !== "flex" && style.display !== "inline-flex") {
    return undefined;
  }

  if (!canPreserveFlexFlow(element, style)) {
    return undefined;
  }

  const layout: AstFlexLayout = {
    mode: style.flexDirection === "row" ? "horizontal" : "vertical",
    gap: parseOptionalPx(style.flexDirection === "row" ? style.columnGap : style.rowGap, 0),
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
    wraps: false
  };
  return matchesMeasuredLayout(element, layout) ? layout : undefined;
}

function canPreserveFlexFlow(element: Element, style: CSSStyleDeclaration): boolean {
  if (
    !["row", "column"].includes(style.flexDirection) ||
    style.flexWrap !== "nowrap" || style.direction !== "ltr" ||
    style.writingMode !== "horizontal-tb" || style.transform !== "none" ||
    !["normal", "flex-start", "start", "center", "flex-end", "end", "space-between"].includes(style.justifyContent) ||
    !["normal", "stretch", "flex-start", "start", "center", "flex-end", "end"].includes(style.alignItems) ||
    element.shadowRoot ||
    Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
  ) {
    return false;
  }
  return Array.from(element.children).every(child => {
    const childStyle = window.getComputedStyle(child);
    if (childStyle.display === "none") return true;
    return childStyle.position !== "absolute" && childStyle.position !== "fixed" &&
      childStyle.visibility !== "hidden" && childStyle.display !== "contents" &&
      childStyle.order === "0" && childStyle.transform === "none" &&
      [childStyle.marginTop, childStyle.marginRight, childStyle.marginBottom, childStyle.marginLeft]
        .every(value => value === "0px");
  });
}

// Fixed-size Auto Layout is safe only when it reproduces the browser's measured
// child positions. Unknown CSS combinations keep absolute geometry instead.
function matchesMeasuredLayout(element: Element, layout: AstFlexLayout): boolean {
  const parent = element.getBoundingClientRect();
  const children = Array.from(element.children)
    .filter(child => window.getComputedStyle(child).display !== "none")
    .map(child => child.getBoundingClientRect());
  const horizontal = layout.mode === "horizontal";
  const start = horizontal ? layout.padding.left : layout.padding.top;
  const end = horizontal ? layout.padding.right : layout.padding.bottom;
  const crossStart = horizontal ? layout.padding.top : layout.padding.left;
  const crossEnd = horizontal ? layout.padding.bottom : layout.padding.right;
  const available = (horizontal ? parent.width : parent.height) - start - end;
  const crossAvailable = (horizontal ? parent.height : parent.width) - crossStart - crossEnd;
  const occupied = children.reduce((sum, child) => sum + (horizontal ? child.width : child.height), 0);
  const free = available - occupied - Math.max(0, children.length - 1) * layout.gap;
  let position = start + alignmentOffset(layout.primaryAxisAlignItems, free);
  const gap = layout.primaryAxisAlignItems === "space-between" && children.length > 1
    ? layout.gap + Math.max(0, free) / (children.length - 1) : layout.gap;
  for (const child of children) {
    const expectedCross = crossStart + alignmentOffset(layout.counterAxisAlignItems,
      crossAvailable - (horizontal ? child.height : child.width));
    const actualMain = horizontal ? child.x - parent.x : child.y - parent.y;
    const actualCross = horizontal ? child.y - parent.y : child.x - parent.x;
    if (Math.abs(actualMain - position) > 0.25 || Math.abs(actualCross - expectedCross) > 0.25) {
      return false;
    }
    position += (horizontal ? child.width : child.height) + gap;
  }
  return true;
}

function alignmentOffset(alignment: string, free: number): number {
  return alignment === "center" ? free / 2 : alignment === "max" ? free : 0;
}
