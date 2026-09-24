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
    removeNode: (node: RenderableNode) => {
      (node as unknown as SceneNode).remove();
    },
    loadFontAsync: (fontName: FontName) => pluginApi.loadFontAsync(fontName),
    createImageAsync: async (source: string) => {
      const embedded = /^data:[^,]*;base64,([\s\S]*)$/i.exec(source);
      // Embedded assets are already portable bytes and need no network API.
      const bytes = embedded
        ? pluginApi.base64Decode(decodeURIComponent(embedded[1]!))
        : await fetchImageBytes(source);
      return pluginApi.createImage(bytes).hash;
    }
  };
}

async function fetchImageBytes(source: string): Promise<Uint8Array> {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
