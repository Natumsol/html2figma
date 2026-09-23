export interface Identity {
  protocol: number;
  runId: string;
  buildId: string;
  documentSha256: string;
  converterSha256: string;
  rendererSha256: string;
  extensionSha256?: string;
  fileKey: string;
  pageId: string;
  binding: string;
  areaTag: string;
}

export interface CanvasState {
  pageId: string;
  selection: string[];
  center: { x: number; y: number };
  zoom: number;
}

export interface RenderTask {
  type: "render-case";
  taskId: string;
  caseId: string;
  documentJson: string;
}

export interface VisualCase {
  name: string;
  documentJson: string;
  documentSha256: string;
  width: number;
  height: number;
  maxDiffPixelRatio: number;
  expectedWarningCodes: string[];
  capture?: { mode: "page" | "selection"; sourceUrl: string; extensionSha256: string;
    downloadFilename: string; downloadedJsonSha256: string };
}

export interface PluginConfig {
  identity: Identity;
  token: string;
  cases: VisualCase[];
  bind: boolean;
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
  return value as Record<string, unknown>;
}

export function readCanvasState(value: unknown): CanvasState {
  const state = record(value);
  const center = record(state.center);
  if (typeof state.pageId !== "string" || !Array.isArray(state.selection) ||
      !state.selection.every(id => typeof id === "string") ||
      typeof center.x !== "number" || !Number.isFinite(center.x) ||
      typeof center.y !== "number" || !Number.isFinite(center.y) ||
      typeof state.zoom !== "number" || !Number.isFinite(state.zoom) || state.zoom <= 0) {
    throw new Error("Invalid canvas state");
  }
  return { pageId: state.pageId, selection: state.selection,
    center: { x: center.x, y: center.y }, zoom: state.zoom };
}

export function sameCanvasState(a: CanvasState, b: CanvasState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
