export interface RenderableNode {
  type?: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: RenderableNode[];
  fills?: unknown[];
  strokes?: unknown[];
  effects?: unknown[];
  [key: string]: unknown;
}

export interface FigmaAdapter {
  currentPage: RenderableNode;
  createFrame(): RenderableNode;
  createRectangle(): RenderableNode;
  createText(): RenderableNode;
  createNodeFromSvg(svg: string): RenderableNode;
  appendChild(parent: RenderableNode, child: RenderableNode): void;
  loadFontAsync(fontName: FontName): Promise<void>;
  createImageAsync(source: string): Promise<string>;
}
