import type {
  AstBounds,
  AstFill,
  AstStyle,
  AstTextStyle,
  Html2FigmaDocument,
  Html2FigmaNode,
  RenderOptions,
  RenderResult,
  RenderWarning,
  ResourceRef
} from "../schema/types";
import { createWarning } from "../utils/warnings";
import type { FigmaAdapter, RenderableNode } from "./adapter";
import { applyBaseProperties, toFigmaRgb } from "./apply-style";

interface RenderContext {
  adapter: FigmaAdapter;
  document: Html2FigmaDocument;
  options: RenderOptions;
  warnings: RenderWarning[];
  nodes: RenderableNode[];
}

export async function renderWithAdapter(
  document: Html2FigmaDocument,
  adapter: FigmaAdapter,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const context: RenderContext = {
    adapter,
    document,
    options,
    warnings: document.warnings.slice(),
    nodes: []
  };
  const rootBounds = {
    ...document.root.bounds,
    x: options.x ?? document.root.bounds.x,
    y: options.y ?? document.root.bounds.y
  };
  const root = await createRenderableNode(document.root, context, rootBounds, false);

  adapter.appendChild(
    (options.parent as RenderableNode | undefined) ?? adapter.currentPage,
    root
  );

  return {
    root: root as unknown as SceneNode,
    nodes: context.nodes as unknown as SceneNode[],
    warnings: context.warnings
  };
}

async function createRenderableNode(
  source: Html2FigmaNode,
  context: RenderContext,
  bounds: AstBounds,
  parentUsesAutoLayout: boolean
): Promise<RenderableNode> {
  const node = await createAdapterNode(source, context);
  const styledSource = await withResolvedImageFills(source, context);

  applyBaseProperties(node, {
    ...styledSource,
    bounds
  });
  context.nodes.push(node);
  context.warnings.push.apply(context.warnings, source.warnings);

  if (source.type === "text") {
    await applyTextProperties(node, source, context);
  }

  if (parentUsesAutoLayout) {
    applyAutoLayoutItemProperties(node);
  }

  for (const child of source.children) {
    const childBounds = source.style.layout
      ? autoLayoutChildBounds(child.bounds)
      : relativeBounds(child.bounds, source.bounds);
    context.adapter.appendChild(
      node,
      await createRenderableNode(child, context, childBounds, Boolean(source.style.layout))
    );
  }

  return node;
}

function applyAutoLayoutItemProperties(node: RenderableNode): void {
  node.layoutPositioning = "AUTO";
  node.layoutSizingHorizontal = "FIXED";
  node.layoutSizingVertical = "FIXED";
}

function autoLayoutChildBounds(bounds: AstBounds): AstBounds {
  return {
    x: 0,
    y: 0,
    width: bounds.width,
    height: bounds.height
  };
}

function relativeBounds(bounds: AstBounds, parentBounds: AstBounds): AstBounds {
  return {
    x: bounds.x - parentBounds.x,
    y: bounds.y - parentBounds.y,
    width: bounds.width,
    height: bounds.height
  };
}

async function createAdapterNode(
  source: Html2FigmaNode,
  context: RenderContext
): Promise<RenderableNode> {
  switch (source.type) {
    case "frame":
      return context.adapter.createFrame();
    case "rectangle":
    case "image":
      return context.adapter.createRectangle();
    case "text":
      return context.adapter.createText();
    case "svg": {
      const resource = findResource(context.document, source.resourceId);
      if (resource?.data) {
        return context.adapter.createNodeFromSvg(resource.data);
      }

      context.warnings.push(
        createWarning("missing-svg-resource", "SVG resource data is missing", "warning", {
          nodeId: source.id,
          source: source.resourceId
        })
      );
      return context.adapter.createFrame();
    }
  }
}

async function withResolvedImageFills(
  source: Html2FigmaNode,
  context: RenderContext
): Promise<Html2FigmaNode> {
  if (source.type === "text") {
    return source;
  }

  let style = source.style;

  if (style.fills) {
    const fills = await Promise.all(
      style.fills.map((fill) => resolveImageFill(fill, context))
    );
    style = {
      ...style,
      fills: fills.filter((fill): fill is AstFill => Boolean(fill))
    };
  }

  if (source.type === "image" && !style.fills?.some((fill) => fill.type === "image")) {
    const imageHash = await createImageHash(source.resourceId, context);
    if (imageHash) {
      const fills = (style.fills ?? []).concat({
        type: "image",
        resourceId: imageHash,
        opacity: 1,
        scaleMode: "fill"
      });
      style = {
        ...style,
        fills
      };
    }
  }

  return {
    ...source,
    style
  } as Html2FigmaNode;
}

async function resolveImageFill(
  fill: AstFill,
  context: RenderContext
): Promise<AstFill | undefined> {
  if (fill.type !== "image") {
    return fill;
  }

  const imageHash = await createImageHash(fill.resourceId, context);
  return imageHash ? { ...fill, resourceId: imageHash } : undefined;
}

async function createImageHash(
  resourceId: string,
  context: RenderContext
): Promise<string | undefined> {
  const resource = findResource(context.document, resourceId);
  if (!resource) {
    context.warnings.push(
      createWarning("missing-image-resource", "Image resource is missing", "warning", {
        source: resourceId
      })
    );
    return undefined;
  }

  try {
    return await context.adapter.createImageAsync(resource.source);
  } catch (error) {
    context.warnings.push(
      createWarning("image-load-failed", "Image resource failed to load", "warning", {
        source: resource.source
      })
    );
    return undefined;
  }
}

async function applyTextProperties(
  target: RenderableNode,
  source: Extract<Html2FigmaNode, { type: "text" }>,
  context: RenderContext
): Promise<void> {
  const textStyle = source.style.text;
  const fontName = toFontName(textStyle);
  let loadedFontName = fontName;

  if (context.options.loadFonts !== false) {
    loadedFontName = await loadFont(fontName, source, context);
  }

  target.fontName = loadedFontName;
  target.characters = source.text;

  if (textStyle?.fontSize !== undefined) {
    target.fontSize = textStyle.fontSize;
  }

  if (textStyle?.lineHeight !== undefined) {
    target.lineHeight = {
      unit: "PIXELS",
      value: textStyle.lineHeight
    };
  }

  if (textStyle?.letterSpacing !== undefined) {
    target.letterSpacing = {
      unit: "PIXELS",
      value: textStyle.letterSpacing
    };
  }

  if (textStyle?.textAlign) {
    target.textAlignHorizontal = mapTextAlign(textStyle.textAlign);
  }

  if (textStyle?.textDecoration) {
    target.textDecoration = textStyle.textDecoration.toUpperCase();
  }

  if (textStyle?.textCase) {
    target.textCase = mapTextCase(textStyle.textCase);
  }

  if (textStyle?.color) {
    target.fills = [
      {
        type: "SOLID",
        color: toFigmaRgb(textStyle.color),
        opacity: 1
      }
    ];
  }
}

async function loadFont(
  fontName: FontName,
  source: Html2FigmaNode,
  context: RenderContext
): Promise<FontName> {
  try {
    await context.adapter.loadFontAsync(fontName);
    return fontName;
  } catch (error) {
    const fallbackFontName = { family: "Inter", style: "Regular" };
    context.warnings.push(
      createWarning("font-load-failed", "Font failed to load; using fallback", "warning", {
        nodeId: source.id,
        source: `${fontName.family} ${fontName.style}`
      })
    );
    await context.adapter.loadFontAsync(fallbackFontName);
    return fallbackFontName;
  }
}

function toFontName(textStyle: AstTextStyle | undefined): FontName {
  return {
    family: textStyle?.fontFamily || "Inter",
    style: fontStyleName(textStyle)
  };
}

function fontStyleName(textStyle: AstTextStyle | undefined): string {
  if (textStyle?.fontStyle === "italic") {
    return textStyle.fontWeight >= 700 ? "Bold Italic" : "Italic";
  }

  if ((textStyle?.fontWeight ?? 400) >= 700) {
    return "Bold";
  }

  return "Regular";
}

function mapTextAlign(value: NonNullable<AstTextStyle["textAlign"]>): string {
  switch (value) {
    case "center":
      return "CENTER";
    case "right":
      return "RIGHT";
    case "justified":
      return "JUSTIFIED";
    default:
      return "LEFT";
  }
}

function mapTextCase(value: NonNullable<AstTextStyle["textCase"]>): string {
  switch (value) {
    case "upper":
      return "UPPER";
    case "lower":
      return "LOWER";
    case "title":
      return "TITLE";
  }
}

function findResource(
  document: Html2FigmaDocument,
  resourceId: string
): ResourceRef | undefined {
  return document.resources.find((resource) => resource.id === resourceId);
}
