import type { AstBounds, AstStyle, TextAstNode } from "../schema/types";
import { parseOptionalPx } from "../utils/length";

export function createTextNode(
  textNode: ChildNode,
  text: string,
  id: string,
  parentStyle: AstStyle,
  parentBounds: AstBounds,
  parentPath: string
): TextAstNode {
  return {
    id,
    type: "text",
    name: "#text",
    text,
    bounds: readTextBounds(textNode, parentStyle, parentBounds),
    style: parentStyle,
    source: {
      tagName: "#text",
      path: `${parentPath} > #text`
    },
    warnings: [],
    children: []
  };
}

function readTextBounds(
  textNode: ChildNode,
  parentStyle: AstStyle,
  fallbackBounds: AstBounds
): AstBounds {
  const document = textNode.ownerDocument;
  if (!document) {
    return fallbackBounds;
  }

  const range = document.createRange();
  range.selectNodeContents(textNode);

  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0
  );
  const rect = rects.length > 0 ? unionRects(rects) : range.getBoundingClientRect();
  range.detach();

  if (rect.width === 0 || rect.height === 0) {
    return fallbackBounds;
  }

  let y = rect.y;
  let height = rect.height;
  const parent = textNode.parentElement;
  const lineHeight = parentStyle.text?.lineHeight;
  let usesBlockLineBox = false;
  if (parent && parent.children.length === 0 && lineHeight !== undefined) {
    const computed = window.getComputedStyle(parent);
    const textNodes = Array.from(parent.childNodes).filter(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
    );
    if (computed.display === "block" && textNodes.length === 1) {
      // Range rectangles cover font metrics, not CSS line boxes. Figma adds
      // line-height leading itself, so using the Range y would add it twice.
      y = fallbackBounds.y + parseOptionalPx(computed.paddingTop, 0)
        + parseOptionalPx(computed.borderTopWidth, 0);
      height = lineHeight * Math.max(1, new Set(rects.map((line) => line.y)).size);
      usesBlockLineBox = true;
    }
  }

  if (!usesBlockLineBox && lineHeight !== undefined && rects.length === 1 && lineHeight > rect.height) {
    // Inline Range rectangles start below the CSS line box by half of its
    // leading. Figma applies that leading again when rendering the text node.
    y -= (lineHeight - rect.height) / 2;
    height = lineHeight;
  }

  if (
    parentStyle.text?.textAlign === "center" ||
    parentStyle.text?.textAlign === "right" ||
    parentStyle.text?.textAlign === "justified"
  ) {
    return {
      x: fallbackBounds.x,
      y,
      width: fallbackBounds.width,
      height
    };
  }

  return {
    x: rect.x,
    y,
    width: hasElementSiblings(textNode)
      ? expandInlineTextWidth(rect.width, parentStyle, fallbackBounds, rect.x)
      : Math.max(rect.width, fallbackBounds.x + fallbackBounds.width - rect.x),
    height
  };
}

function expandInlineTextWidth(
  width: number,
  parentStyle: AstStyle,
  fallbackBounds: AstBounds,
  x: number
): number {
  const fontSize = parentStyle.text?.fontSize ?? 16;
  const tolerance = Math.min(24, Math.max(8, fontSize * 0.35));
  return Math.min(width + tolerance, fallbackBounds.x + fallbackBounds.width - x);
}

function hasElementSiblings(textNode: ChildNode): boolean {
  const parent = textNode.parentElement;
  return Boolean(parent && parent.children.length > 0);
}

function unionRects(rects: DOMRect[]): AstBounds {
  let left = rects[0]!.left;
  let top = rects[0]!.top;
  let right = rects[0]!.right;
  let bottom = rects[0]!.bottom;

  for (const rect of rects.slice(1)) {
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}
