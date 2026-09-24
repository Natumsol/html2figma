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
import { createWarning, uniqueWarnings } from "../utils/warnings";
import type { FigmaAdapter, RenderableNode } from "./adapter";
import { applyBaseProperties, toFigmaRgb } from "./apply-style";

interface RenderContext {
  adapter: FigmaAdapter;
  document: Html2FigmaDocument;
  options: RenderOptions<RenderableNode>;
  warnings: RenderWarning[];
  nodes: RenderableNode[];
  createdNodes: RenderableNode[];
}

export async function renderWithAdapter(
  document: Html2FigmaDocument,
  adapter: FigmaAdapter,
  options: RenderOptions<RenderableNode> = {}
): Promise<RenderResult<RenderableNode>> {
  const context: RenderContext = {
    adapter,
    document,
    options,
    warnings: document.warnings.slice(),
    nodes: [],
    createdNodes: []
  };
  const rootBounds = {
    ...document.root.bounds,
    x: options.x ?? document.root.bounds.x,
    y: options.y ?? document.root.bounds.y
  };
  try {
    const root = await createRenderableNode(document.root, context, rootBounds);
    adapter.appendChild(options.parent ?? adapter.currentPage, root);
    return { root, nodes: context.nodes, warnings: uniqueWarnings(context.warnings) };
  } catch (error) {
    const cleanupErrors: unknown[] = [];
    for (const node of context.createdNodes.reverse()) {
      try {
        adapter.removeNode(node);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (cleanupErrors.length) {
      throw new AggregateError([error, ...cleanupErrors], "Render failed and could not remove all created nodes");
    }
    throw error;
  }
}

async function createRenderableNode(
  source: Html2FigmaNode,
  context: RenderContext,
  bounds: AstBounds
): Promise<RenderableNode> {
  const node = await createAdapterNode(source, context);
  context.createdNodes.push(node);
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

  for (const child of source.children) {
    const childBounds = source.style.layout && !isBorderHelperNode(child)
      ? autoLayoutChildBounds(child.bounds)
      : relativeBounds(child.bounds, source.bounds);
    const childNode = await createRenderableNode(child, context, childBounds);
    context.adapter.appendChild(node, childNode);
    // Figma requires an Auto Layout parent before child positioning can be set.
    if (source.style.layout && isBorderHelperNode(child)) {
      applyAbsoluteLayoutItemProperties(childNode);
      // Appending initially places the helper in the layout flow.
      childNode.x = childBounds.x;
      childNode.y = childBounds.y;
    } else if (source.style.layout) {
      applyAutoLayoutItemProperties(childNode);
    }
  }

  return node;
}

function applyAutoLayoutItemProperties(node: RenderableNode): void {
  node.layoutPositioning = "AUTO";
  node.layoutSizingHorizontal = "FIXED";
  node.layoutSizingVertical = "FIXED";
}

function applyAbsoluteLayoutItemProperties(node: RenderableNode): void {
  node.layoutPositioning = "ABSOLUTE";
  node.layoutSizingHorizontal = "FIXED";
  node.layoutSizingVertical = "FIXED";
}

function isBorderHelperNode(node: Html2FigmaNode): boolean {
  return node.source.tagName === "#border" || node.name.startsWith("#border-");
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

  if (source.type === "image" && !hasOwnImageFill(source)) {
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

function hasOwnImageFill(source: Extract<Html2FigmaNode, { type: "image" }>): boolean {
  return Boolean(
    source.style.fills?.some(
      (fill) => fill.type === "image" && fill.resourceId === source.resourceId
    )
  );
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
    target.textDecoration = ({ none: "NONE", underline: "UNDERLINE", strikethrough: "STRIKETHROUGH" } as const)[textStyle.textDecoration];
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

function mapTextAlign(value: NonNullable<AstTextStyle["textAlign"]>): TextNode["textAlignHorizontal"] {
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

function mapTextCase(value: NonNullable<AstTextStyle["textCase"]>): TextCase {
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
