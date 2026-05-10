import type {
  AstFlexLayout,
  AstShadow,
  AstStyle,
  Html2FigmaNode,
  Rgb
} from "../schema/types";
import type { RenderableNode } from "./adapter";

export function applyBaseProperties(
  target: RenderableNode,
  source: Html2FigmaNode
): void {
  target.name = source.name;
  target.x = source.bounds.x;
  target.y = source.bounds.y;
  target.width = source.bounds.width;
  target.height = source.bounds.height;

  if (typeof target.resize === "function") {
    target.resize(source.bounds.width, source.bounds.height);
  }

  if (source.type !== "text") {
    applyStyle(target, source.style);
  }
}

export function applyStyle(target: RenderableNode, style: AstStyle): void {
  if (style.fills) {
    target.fills = style.fills.map((fill) => {
      if (fill.type === "solid") {
        return {
          type: "SOLID",
          color: toFigmaRgb(fill.color),
          opacity: fill.opacity
        };
      }

      return {
        type: "IMAGE",
        imageHash: fill.resourceId,
        scaleMode: fill.scaleMode.toUpperCase(),
        opacity: fill.opacity
      };
    });
  }

  if (style.strokes) {
    target.strokes = style.strokes.map((stroke) => ({
      type: "SOLID",
      color: toFigmaRgb(stroke.color),
      opacity: stroke.opacity
    }));
    target.strokeWeight = style.strokes[0]?.weight ?? 0;
    target.strokeAlign = style.strokes[0]?.align.toUpperCase();
  }

  if (style.effects) {
    target.effects = style.effects.map(toFigmaEffect);
  }

  if (style.cornerRadius) {
    target.topLeftRadius = style.cornerRadius.topLeft;
    target.topRightRadius = style.cornerRadius.topRight;
    target.bottomRightRadius = style.cornerRadius.bottomRight;
    target.bottomLeftRadius = style.cornerRadius.bottomLeft;
  }

  if (style.opacity !== undefined) {
    target.opacity = style.opacity;
  }

  if (style.layout) {
    applyLayout(target, style.layout);
  }
}

function applyLayout(target: RenderableNode, layout: AstFlexLayout): void {
  target.layoutMode = layout.mode.toUpperCase();
  target.itemSpacing = layout.gap;
  target.paddingTop = layout.padding.top;
  target.paddingRight = layout.padding.right;
  target.paddingBottom = layout.padding.bottom;
  target.paddingLeft = layout.padding.left;
  target.primaryAxisAlignItems = mapPrimaryAxisAlign(layout.primaryAxisAlignItems);
  target.counterAxisAlignItems = mapCounterAxisAlign(layout.counterAxisAlignItems);
  target.layoutWrap = layout.wraps ? "WRAP" : "NO_WRAP";
}

function mapPrimaryAxisAlign(value: AstFlexLayout["primaryAxisAlignItems"]): string {
  return value === "space-between" ? "SPACE_BETWEEN" : value.toUpperCase();
}

function mapCounterAxisAlign(value: AstFlexLayout["counterAxisAlignItems"]): string {
  return value.toUpperCase();
}

function toFigmaEffect(effect: AstShadow): Record<string, unknown> {
  return {
    type: "DROP_SHADOW",
    color: toFigmaRgba(effect.color, effect.opacity),
    offset: {
      x: effect.offsetX,
      y: effect.offsetY
    },
    radius: effect.blur,
    spread: effect.spread,
    visible: true
  };
}

function toFigmaRgb(color: Rgb): RGB {
  return {
    r: color.r / 255,
    g: color.g / 255,
    b: color.b / 255
  };
}

function toFigmaRgba(color: Rgb, opacity: number): RGBA {
  return {
    ...toFigmaRgb(color),
    a: opacity
  };
}
