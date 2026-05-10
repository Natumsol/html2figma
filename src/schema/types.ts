export type NodeId = string;

export interface AstBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface SolidFill {
  type: "solid";
  color: Rgb;
  opacity: number;
}

export interface ImageFill {
  type: "image";
  resourceId: string;
  opacity: number;
  scaleMode: "fill" | "fit" | "crop" | "tile";
}

export type AstFill = SolidFill | ImageFill;

export interface AstStroke {
  color: Rgb;
  opacity: number;
  weight: number;
  align: "inside" | "center" | "outside";
}

export interface AstShadow {
  type: "drop-shadow";
  color: Rgb;
  opacity: number;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
}

export interface AstTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: "normal" | "italic";
  lineHeight: number;
  letterSpacing: number;
  textAlign: "left" | "center" | "right" | "justified";
  textDecoration: "none" | "underline" | "strikethrough";
  color: Rgb;
}

export interface AstFlexLayout {
  mode: "horizontal" | "vertical";
  gap: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  primaryAxisAlignItems: "min" | "center" | "max" | "space-between";
  counterAxisAlignItems: "min" | "center" | "max";
  wraps: boolean;
}

export interface AstStyle {
  opacity?: number;
  fills?: AstFill[];
  strokes?: AstStroke[];
  cornerRadius?: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  };
  effects?: AstShadow[];
  text?: AstTextStyle;
  layout?: AstFlexLayout;
}

export type WarningSeverity = "info" | "warning" | "error";

export interface ConvertWarning {
  code: string;
  message: string;
  severity: WarningSeverity;
  nodeId?: NodeId;
  cssProperty?: string;
  source?: string;
}

export type RenderWarning = ConvertWarning;

export interface ResourceRef {
  id: string;
  type: "image" | "svg";
  source: string;
  data?: string;
  mimeType?: string;
}

export interface AstSource {
  tagName: string;
  path: string;
}

export interface BaseAstNode {
  id: NodeId;
  name: string;
  bounds: AstBounds;
  style: AstStyle;
  source: AstSource;
  warnings: ConvertWarning[];
  children: Html2FigmaNode[];
}

export interface FrameAstNode extends BaseAstNode {
  type: "frame";
}

export interface TextAstNode extends BaseAstNode {
  type: "text";
  text: string;
}

export interface RectangleAstNode extends BaseAstNode {
  type: "rectangle";
}

export interface ImageAstNode extends BaseAstNode {
  type: "image";
  resourceId: string;
  alt: string;
}

export interface SvgAstNode extends BaseAstNode {
  type: "svg";
  resourceId: string;
}

export type Html2FigmaNode =
  | FrameAstNode
  | TextAstNode
  | RectangleAstNode
  | ImageAstNode
  | SvgAstNode;

export interface Html2FigmaDocument {
  version: 1;
  root: FrameAstNode;
  resources: ResourceRef[];
  warnings: ConvertWarning[];
  metadata: {
    sourceUrl?: string;
    viewport: {
      width: number;
      height: number;
    };
    createdAt: string;
  };
}

export interface ConvertOptions {
  strict?: boolean;
  includeHidden?: boolean;
  preserveTextNodes?: boolean;
  maxDepth?: number;
}

export interface RenderOptions {
  parent?: BaseNode & ChildrenMixin;
  x?: number;
  y?: number;
  loadFonts?: boolean;
}

export interface RenderResult {
  root: SceneNode;
  nodes: SceneNode[];
  warnings: RenderWarning[];
}
