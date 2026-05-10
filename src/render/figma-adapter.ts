import type { FigmaAdapter, RenderableNode } from "./adapter";

export function createFigmaAdapter(pluginApi: PluginAPI = figma): FigmaAdapter {
  return {
    currentPage: pluginApi.currentPage as unknown as RenderableNode,
    createFrame: () => pluginApi.createFrame() as unknown as RenderableNode,
    createRectangle: () => pluginApi.createRectangle() as unknown as RenderableNode,
    createText: () => pluginApi.createText() as unknown as RenderableNode,
    createNodeFromSvg: (svg: string) =>
      pluginApi.createNodeFromSvg(svg) as unknown as RenderableNode,
    appendChild: (parent: RenderableNode, child: RenderableNode) => {
      (parent as unknown as ChildrenMixin).appendChild(child as unknown as SceneNode);
    },
    loadFontAsync: (fontName: FontName) => pluginApi.loadFontAsync(fontName),
    createImageAsync: async (source: string) => {
      const response = await fetch(source);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return pluginApi.createImage(bytes).hash;
    }
  };
}
