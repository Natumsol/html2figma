import type {
  ConvertOptions,
  Html2FigmaDocument
} from "./schema/types";

export function convert(
  input: Element | Document,
  options: ConvertOptions = {}
): Html2FigmaDocument {
  void input;
  void options;
  throw new Error("convert requires the DOM conversion task");
}
