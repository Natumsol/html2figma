// Keep the adapter's writable surface explicit. Native Figma conversion belongs
// in figma-adapter.ts; unknown properties must fail compilation here.
type LayoutProperties = Pick<FrameNode,
  "layoutMode" | "primaryAxisSizingMode" | "counterAxisSizingMode" |
  "itemSpacing" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft" |
  "primaryAxisAlignItems" | "counterAxisAlignItems" | "layoutWrap" |
  "layoutPositioning" | "layoutSizingHorizontal" | "layoutSizingVertical"
>;
type TextProperties = Pick<TextNode,
  "fontName" | "characters" | "fontSize" | "lineHeight" | "letterSpacing" |
  "textAlignHorizontal" | "textDecoration" | "textCase"
>;

export interface RenderableNode extends Partial<LayoutProperties & TextProperties> {
  type?: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  resize?(width: number, height: number): void;
  children?: RenderableNode[];
  fills?: Paint[];
  strokes?: SolidPaint[];
  strokeWeight?: number;
  strokeAlign?: "INSIDE" | "CENTER" | "OUTSIDE";
  effects?: Effect[];
  opacity?: number;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomRightRadius?: number;
  bottomLeftRadius?: number;
}

export interface FigmaAdapter {
  currentPage: RenderableNode;
  createFrame(): RenderableNode;
  createRectangle(): RenderableNode;
  createText(): RenderableNode;
  createNodeFromSvg(svg: string): RenderableNode;
  appendChild(parent: RenderableNode, child: RenderableNode): void;
  removeNode(node: RenderableNode): void;
  loadFontAsync(fontName: FontName): Promise<void>;
  createImageAsync(source: string): Promise<string>;
}
