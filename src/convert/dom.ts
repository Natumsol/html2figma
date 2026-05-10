import type {
  AstBounds,
  AstSource,
  AstStyle,
  ConvertOptions,
  ConvertWarning,
  Html2FigmaNode,
  ImageAstNode,
  ResourceRef,
  SvgAstNode,
  TextAstNode
} from "../schema/types";
import { readBounds } from "./layout";
import { readStyle } from "./styles";

export interface ConvertContext {
  options: ConvertOptions;
  resources: ResourceRef[];
  warnings: ConvertWarning[];
  nextId: number;
}

export function convertElement(
  element: Element,
  context: ConvertContext,
  depth = 0
): Html2FigmaNode | undefined {
  if (context.options.maxDepth !== undefined && depth > context.options.maxDepth) {
    return undefined;
  }

  const computedStyle = window.getComputedStyle(element);
  if (
    context.options.includeHidden !== true &&
    (computedStyle.display === "none" || computedStyle.visibility === "hidden")
  ) {
    return undefined;
  }

  const id = nextNodeId(context);
  const bounds = readBounds(element);
  const source = readSource(element);
  const { style, warnings } = readStyle(element, id);
  context.warnings.push(...warnings);

  const children = convertChildren(element, context, depth, style, bounds, source.path);
  const baseNode = {
    id,
    name: readableName(element),
    bounds,
    style,
    source,
    warnings,
    children
  };

  if (element instanceof HTMLImageElement) {
    const resourceId = `resource-${context.resources.length + 1}`;
    context.resources.push({
      id: resourceId,
      type: "image",
      source: element.currentSrc || element.src,
      mimeType: imageMimeType(element.currentSrc || element.src)
    });

    return {
      ...baseNode,
      type: "image",
      resourceId,
      alt: element.alt || undefined
    } satisfies ImageAstNode;
  }

  if (element instanceof SVGElement && element.ownerSVGElement === null) {
    const resourceId = `resource-${context.resources.length + 1}`;
    context.resources.push({
      id: resourceId,
      type: "svg",
      source: cssPath(element),
      data: element.outerHTML,
      mimeType: "image/svg+xml"
    });

    return {
      ...baseNode,
      type: "svg",
      resourceId
    } satisfies SvgAstNode;
  }

  if (children.length === 0 && hasVisualBox(style)) {
    return {
      ...baseNode,
      type: "rectangle"
    };
  }

  return {
    ...baseNode,
    type: "frame"
  };
}

function convertChildren(
  element: Element,
  context: ConvertContext,
  depth: number,
  parentStyle: AstStyle,
  parentBounds: AstBounds,
  parentPath: string
): Html2FigmaNode[] {
  const children: Html2FigmaNode[] = [];

  for (const child of Array.from(element.childNodes)) {
    const childDepth = depth + 1;
    if (child.nodeType === Node.TEXT_NODE) {
      if (context.options.maxDepth !== undefined && childDepth > context.options.maxDepth) {
        continue;
      }

      const text = collapseText(child.textContent ?? "");
      if (text) {
        children.push(createTextNode(text, context, parentStyle, parentBounds, parentPath));
      }
      continue;
    }

    if (child instanceof Element) {
      const childNode = convertElement(child, context, childDepth);
      if (childNode) {
        children.push(childNode);
      }
    }
  }

  return children;
}

function createTextNode(
  text: string,
  context: ConvertContext,
  parentStyle: AstStyle,
  parentBounds: AstBounds,
  parentPath: string
): TextAstNode {
  const id = nextNodeId(context);

  return {
    id,
    type: "text",
    name: "#text",
    text,
    bounds: parentBounds,
    style: parentStyle,
    source: {
      tagName: "#text",
      path: `${parentPath} > #text`
    },
    warnings: [],
    children: []
  };
}

function nextNodeId(context: ConvertContext): string {
  const id = `node-${context.nextId}`;
  context.nextId += 1;
  return id;
}

function hasVisualBox(style: AstStyle): boolean {
  return Boolean(
    style.fills?.length ||
      style.strokes?.length ||
      style.effects?.length ||
      (style.cornerRadius &&
        Object.values(style.cornerRadius).some((radius) => radius > 0))
  );
}

function collapseText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function readableName(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const className = Array.from(element.classList)
    .map((name) => `.${name}`)
    .join("");

  return `${tagName}${id}${className}`;
}

function readSource(element: Element): AstSource {
  return {
    tagName: element.tagName.toLowerCase(),
    path: cssPath(element)
  };
}

function cssPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current) {
    const tagName = current.tagName.toLowerCase();
    const id = current.id ? `#${current.id}` : "";
    const className = Array.from(current.classList)
      .map((name) => `.${name}`)
      .join("");
    const sameTagSiblings = current.parentElement
      ? Array.from(current.parentElement.children).filter(
          (sibling) => sibling.tagName === current?.tagName
        )
      : [];
    const index =
      sameTagSiblings.length > 1 ? `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})` : "";

    parts.unshift(`${tagName}${id}${className}${index}`);
    current = current.parentElement;
  }

  return parts.join(" > ");
}

function imageMimeType(source: string): string | undefined {
  const path = source.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".png")) {
    return "image/png";
  }
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (path.endsWith(".gif")) {
    return "image/gif";
  }
  if (path.endsWith(".webp")) {
    return "image/webp";
  }
  if (path.endsWith(".svg")) {
    return "image/svg+xml";
  }

  return undefined;
}
