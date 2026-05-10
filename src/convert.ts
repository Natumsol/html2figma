import type {
  ConvertOptions,
  Html2FigmaDocument
} from "./schema/types";
import { convertElement, type ConvertContext } from "./convert/dom";

export function convert(
  input: Element | Document,
  options: ConvertOptions = {}
): Html2FigmaDocument {
  const rootElement = input instanceof Document ? input.documentElement : input;
  const context: ConvertContext = {
    options,
    resources: [],
    warnings: [],
    nextId: 1
  };
  const root = convertElement(rootElement, context);

  if (!root) {
    throw new Error("Unable to convert root element");
  }

  return {
    version: 1,
    root,
    resources: context.resources,
    warnings: context.warnings,
    metadata: {
      sourceUrl: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      createdAt: new Date().toISOString()
    }
  };
}
