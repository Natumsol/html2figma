import type {
  Html2FigmaDocument,
  RenderOptions,
  RenderResult
} from "./schema/types";
import { renderWithAdapter } from "./render/create-node";
import { createFigmaAdapter } from "./render/figma-adapter";

export async function render(
  document: Html2FigmaDocument,
  options: RenderOptions = {}
): Promise<RenderResult> {
  return renderWithAdapter(document, createFigmaAdapter(), options);
}
