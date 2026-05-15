import type { AstBounds, Html2FigmaNode, Rgb } from "../schema/types";

export type BorderSide = "top" | "right" | "bottom" | "left";

export interface BorderPaint {
  side: BorderSide;
  weight: number;
  color: Rgb;
  opacity: number;
}

export function createBorderRectangleBounds(
  side: BorderSide,
  bounds: AstBounds,
  weight: number
): AstBounds {
  switch (side) {
    case "top":
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: weight };
    case "right":
      return {
        x: bounds.x + bounds.width - weight,
        y: bounds.y,
        width: weight,
        height: bounds.height
      };
    case "bottom":
      return {
        x: bounds.x,
        y: bounds.y + bounds.height - weight,
        width: bounds.width,
        height: weight
      };
    case "left":
      return { x: bounds.x, y: bounds.y, width: weight, height: bounds.height };
  }
}

export function createBorderRectangleNode(
  parent: Html2FigmaNode,
  side: BorderSide,
  paint: BorderPaint,
  id: string
): Html2FigmaNode {
  return {
    id,
    type: "rectangle",
    name: `#border-${side}`,
    bounds: createBorderRectangleBounds(side, parent.bounds, paint.weight),
    style: {
      fills: [{ type: "solid", color: paint.color, opacity: paint.opacity }]
    },
    source: {
      tagName: "#border",
      path: `${parent.source.path} > #border-${side}`
    },
    warnings: [],
    children: []
  };
}
