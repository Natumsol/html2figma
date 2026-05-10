import type {
  Html2FigmaDocument,
  RenderOptions,
  RenderResult
} from "./schema/types";

export async function render(
  document: Html2FigmaDocument,
  options: RenderOptions = {}
): Promise<RenderResult> {
  void document;
  void options;
  throw new Error("render requires the Figma rendering task");
}
