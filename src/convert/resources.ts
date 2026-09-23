import type { ConvertWarning, ResourceRef } from "../schema/types";
import { imageMimeType } from "../utils/background";
import { createWarning } from "../utils/warnings";

export function addImageResource(source: string, resources: ResourceRef[]): string {
  const id = `resource-${resources.length + 1}`;
  resources.push({ id, type: "image", source, mimeType: imageMimeType(source) });
  return id;
}

export function serializeSvg(
  element: SVGElement,
  nodeId: string
): { data: string; warnings: ConvertWarning[] } {
  const warnings: ConvertWarning[] = [];
  const clone = element.cloneNode(true) as SVGElement;

  for (const use of Array.from(clone.querySelectorAll("use"))) {
    const href = use.getAttribute("href") || use.getAttribute("xlink:href");
    if (!href?.startsWith("#")) {
      continue;
    }

    const symbol = element.ownerDocument.getElementById(href.slice(1));
    if (!symbol) {
      const warning = createWarning(
        "svg-use-unresolved",
        "SVG use reference could not be resolved",
        "warning",
        {
          nodeId,
          source: href
        }
      );
      warnings.push(warning);
      continue;
    }

    use.replaceWith(...Array.from(symbol.childNodes).map((child) => child.cloneNode(true)));
  }

  return { data: clone.outerHTML, warnings };
}
