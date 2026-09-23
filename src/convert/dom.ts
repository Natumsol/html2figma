import type {
  AstBounds,
  AstSource,
  AstStyle,
  ConvertOptions,
  ConvertWarning,
  Html2FigmaNode,
  ImageAstNode,
  ResourceRef,
  SvgAstNode
} from "../schema/types";
import { addImageResource, serializeSvg } from "./resources";
import { createTextNode } from "./text";
import { createWarning } from "../utils/warnings";
import { createBorderRectangleNode } from "./borders";
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
  depth = 0,
  shadowRootPath?: string
): Html2FigmaNode | undefined {
  if (element instanceof HTMLSourceElement) {
    return undefined;
  }

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
  const source = readSource(element, shadowRootPath);
  const { style, warnings, borderSides } = readStyle(element, id, context.resources);
  context.warnings.push(...warnings);

  if (element instanceof HTMLVideoElement && element.poster) {
    warnUnsupportedBorderChildren(context, warnings, id, borderSides, "video poster");

    const resourceId = addImageResource(element.poster, context.resources);

    return {
      id,
      name: readableName(element),
      bounds,
      style,
      source,
      warnings,
      children: [],
      type: "image",
      resourceId
    } satisfies ImageAstNode;
  }

  const children = convertChildren(
    element,
    context,
    depth,
    style,
    bounds,
    source.path,
    shadowRootPath
  );
  if (element instanceof HTMLPictureElement && children.length === 0) {
    return undefined;
  }

  const baseNode = {
    id,
    name: readableName(element),
    bounds,
    style,
    source,
    warnings,
    children
  };

  if (element instanceof HTMLVideoElement) {
    const warning = createWarning(
      "video-poster-missing",
      "Video poster is missing; rendering video as a frame",
      "warning",
      {
        nodeId: id,
        source: source.path
      }
    );
    context.warnings.push(warning);
    baseNode.warnings.push(warning);
  }

  if (element instanceof HTMLImageElement) {
    warnUnsupportedBorderChildren(context, baseNode.warnings, id, borderSides, "image");

    const resourceId = addImageResource(element.currentSrc || element.src, context.resources);

    return {
      ...baseNode,
      type: "image",
      resourceId,
      alt: element.alt || undefined
    } satisfies ImageAstNode;
  }

  if (element instanceof SVGElement && element.ownerSVGElement === null) {
    warnUnsupportedBorderChildren(context, baseNode.warnings, id, borderSides, "svg");

    const resourceId = `resource-${context.resources.length + 1}`;
    const svg = serializeSvg(element, id);
    context.warnings.push(...svg.warnings);
    baseNode.warnings.push(...svg.warnings);
    context.resources.push({
      id: resourceId,
      type: "svg",
      source: cssPath(element),
      data: svg.data,
      mimeType: "image/svg+xml"
    });

    return {
      ...baseNode,
      type: "svg",
      resourceId
    } satisfies SvgAstNode;
  }

  if (!style.layout && children.length === 0 && hasVisualBox(style) && borderSides.length === 0) {
    return {
      ...baseNode,
      type: "rectangle"
    };
  }

  const node: Html2FigmaNode = {
    ...baseNode,
    type: "frame"
  };

  node.children.push(
    ...borderSides.map((paint) =>
      createBorderRectangleNode(node, paint.side, paint, nextNodeId(context))
    )
  );

  return node;
}

function warnUnsupportedBorderChildren(
  context: ConvertContext,
  nodeWarnings: ConvertWarning[],
  nodeId: string,
  borderSides: unknown[],
  nodeType: string
): void {
  if (borderSides.length === 0) {
    return;
  }

  const warning = createWarning(
    "unsupported-border-style",
    `Asymmetric border helpers cannot be attached to ${nodeType} nodes`,
    "warning",
    {
      nodeId,
      cssProperty: "border",
      source: nodeType
    }
  );
  context.warnings.push(warning);
  nodeWarnings.push(warning);
}

function convertChildren(
  element: Element,
  context: ConvertContext,
  depth: number,
  parentStyle: AstStyle,
  parentBounds: AstBounds,
  parentPath: string,
  shadowRootPath?: string
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
        children.push(createTextNode(child, text, nextNodeId(context), parentStyle, parentBounds, parentPath));
      }
      continue;
    }

    if (child instanceof Element) {
      const childNode = convertElement(child, context, childDepth, shadowRootPath);
      if (childNode) {
        children.push(childNode);
      }
    }
  }

  if (element.shadowRoot) {
    const rootPath = `${parentPath}::shadow`;

    for (const child of Array.from(element.shadowRoot.childNodes)) {
      const childDepth = depth + 1;
      if (child.nodeType === Node.TEXT_NODE) {
        if (context.options.maxDepth !== undefined && childDepth > context.options.maxDepth) {
          continue;
        }

        const text = collapseText(child.textContent ?? "");
        if (text) {
          children.push(createTextNode(child, text, nextNodeId(context), parentStyle, parentBounds, rootPath));
        }
        continue;
      }

      if (child instanceof Element) {
        const childNode = convertElement(child, context, childDepth, rootPath);
        if (childNode) {
          children.push(childNode);
        }
      }
    }
  }

  return children;
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

function readSource(element: Element, shadowRootPath?: string): AstSource {
  return {
    tagName: element.tagName.toLowerCase(),
    path: shadowRootPath ? shadowCssPath(element, shadowRootPath) : cssPath(element)
  };
}

function shadowCssPath(element: Element, rootPath: string): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current) {
    parts.unshift(readableName(current));
    current = current.parentElement;
  }

  return `${rootPath} > ${parts.join(" > ")}`;
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
