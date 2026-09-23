import type {
  Html2FigmaDocument,
  RenderOptions as PortableRenderOptions,
  RenderResult as PortableRenderResult
} from "./schema/types";
import { renderWithAdapter } from "./render/create-node";
import { createFigmaAdapter } from "./render/figma-adapter";
import type { RenderableNode } from "./render/adapter";

export type RenderOptions = PortableRenderOptions<BaseNode & ChildrenMixin>;
export type RenderResult = PortableRenderResult<SceneNode>;

export async function render(
  document: Html2FigmaDocument,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const result = await renderWithAdapter(document, createFigmaAdapter(), {
    ...options,
    parent: options.parent as unknown as RenderableNode | undefined
  });
  // The native adapter creates real Figma nodes; keep the cast at this boundary.
  return result as unknown as RenderResult;
}
