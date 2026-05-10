import type {
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
import { applyBaseProperties } from "./apply-style";

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
    warnings: [...document.warnings],
    nodes: []
  };
  const root = await createRenderableNode(document.root, context);

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
  context: RenderContext
): Promise<RenderableNode> {
  const node = await createAdapterNode(source, context);
  const styledSource = await withResolvedImageFills(source, context);

  applyBaseProperties(node, styledSource);
  context.nodes.push(node);
  context.warnings.push(...source.warnings);

  if (source.type === "text") {
    await applyTextProperties(node, source, context);
  }

  for (const child of source.children) {
    context.adapter.appendChild(node, await createRenderableNode(child, context));
  }

  return node;
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
    style = {
      ...style,
      fills: await Promise.all(
        style.fills.map((fill) => resolveImageFill(fill, context))
      )
    };
  }

  if (source.type === "image" && !style.fills?.some((fill) => fill.type === "image")) {
    const imageHash = await createImageHash(source.resourceId, context);
    if (imageHash) {
      style = {
        ...style,
        fills: [
          ...(style.fills ?? []),
          {
            type: "image",
            resourceId: imageHash,
            opacity: 1,
            scaleMode: "fill"
          }
        ]
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
): Promise<AstFill> {
  if (fill.type !== "image") {
    return fill;
  }

  const imageHash = await createImageHash(fill.resourceId, context);
  return imageHash ? { ...fill, resourceId: imageHash } : fill;
}

async function createImageHash(
  resourceId: string,
  context: RenderContext
): Promise<string | undefined> {
  const resource = findResource(context.document, resourceId);
  if (!resource) {
    return undefined;
  }

  return context.adapter.createImageAsync(resource.source);
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

  if (textStyle?.color) {
    target.fills = [
      {
        type: "SOLID",
        color: {
          r: textStyle.color.r / 255,
          g: textStyle.color.g / 255,
          b: textStyle.color.b / 255
        },
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

function findResource(
  document: Html2FigmaDocument,
  resourceId: string
): ResourceRef | undefined {
  return document.resources.find((resource) => resource.id === resourceId);
}
