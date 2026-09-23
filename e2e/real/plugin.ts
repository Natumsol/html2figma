import { render } from "html2figma/render";
import { parseDocumentJson } from "../../example/figma-plugin/src/shared/document";
import { record, sameCanvasState, type CanvasState, type PluginConfig } from "./protocol";
import { createTransport } from "./transport";

declare const __REAL_CONFIG__: PluginConfig;
const config = __REAL_CONFIG__;
const markerKey = "html2figma-real-binding-v1";
const pluginSession = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let readyState: CanvasState | undefined;
let busy = false;
let caseIndex = 0;
let area: FrameNode | undefined;

function snapshot(): CanvasState {
  return { pageId: figma.currentPage.id, selection: figma.currentPage.selection.map(node => node.id),
    center: figma.viewport.center, zoom: figma.viewport.zoom };
}
function assertTarget(allowBinding = false): void {
  if (figma.fileKey !== config.identity.fileKey || figma.currentPage.id !== config.identity.pageId) {
    throw new Error("Wrong acceptance file/page; no writes permitted");
  }
  const marker = figma.root.getPluginData(markerKey);
  if (!marker && allowBinding && config.bind) figma.root.setPluginData(markerKey, config.identity.binding);
  else if (marker !== config.identity.binding) throw new Error("File binding missing or mismatched");
}
function send(type: string, data: Record<string, unknown> = {}): void {
  figma.ui.postMessage({ bridge: "html2figma-real", ...config.identity, pluginSession, type, ...data });
}

async function inspectImagePaints(root: FrameNode): Promise<Array<Record<string, unknown>>> {
  const nodes = [root, ...root.findAll()];
  const paints: Array<Record<string, unknown>> = [];
  for (const node of nodes) {
    if (!("fills" in node) || !Array.isArray(node.fills)) continue;
    for (const fill of node.fills) {
      if (fill.type !== "IMAGE") continue;
      const image = figma.getImageByHash(fill.imageHash);
      if (!image) throw new Error(`Image paint has no Figma resource on node ${node.id}`);
      const bytes = await image.getBytesAsync();
      if (!bytes.length) throw new Error(`Image paint has empty Figma resource on node ${node.id}`);
      paints.push({ nodeId: node.id, imageHash: fill.imageHash, byteLength: bytes.length,
        x: node.x, y: node.y, width: node.width, height: node.height, visible: node.visible });
    }
  }
  return paints;
}

figma.showUI(createTransport(config), { visible: false });
figma.ui.onmessage = async (value: unknown) => {
  try {
    const message = record(value);
    if (message.runId !== config.identity.runId) return;
    if (message.type === "receipt") { figma.closePlugin(); return; }
    if (message.type === "transport-ready") {
      if (readyState) return;
      assertTarget(true);
      readyState = snapshot();
      send("ready", { state: readyState });
      return;
    }
    if (message.type !== "execute" || !readyState || busy) return;
    busy = true;
    const task = record(message.task);
    const expected = config.cases[caseIndex];
    if (!expected || task.type !== "render-case" || task.caseId !== expected.name ||
        task.taskId !== `${config.identity.runId}:${expected.name}` ||
        task.documentJson !== expected.documentJson) throw new Error("Unexpected render task/input");
    assertTarget();
    const before = snapshot();
    if (!sameCanvasState(readyState, before)) throw new Error("Canvas changed since handshake");
    const document = parseDocumentJson(task.documentJson as string);
    if (!area) {
      const x = Math.max(0, ...figma.currentPage.children.map(node => node.x + node.width)) + 200;
      area = figma.createFrame();
      area.name = `html2figma E2E — ${config.identity.runId}`;
      area.setPluginData("html2figma-real-owner", config.identity.areaTag);
      area.x = x; area.y = 100; area.resize(1100, 500); area.fills = []; area.clipsContent = false;
      send("area", { taskId: task.taskId, caseId: task.caseId, areaId: area.id });
    }
    const result = await render(document, { parent: area, x: (caseIndex % 3) * 360,
      y: Math.floor(caseIndex / 3) * 220, loadFonts: true });
    if (result.root.type !== "FRAME") throw new Error("Visual case root is not a frame");
    const imagePaints = await inspectImagePaints(result.root);
    if (expected.name === "media" && imagePaints.length === 0) throw new Error("Media image paint missing");
    const png = await result.root.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 1 },
      colorProfile: "SRGB", useAbsoluteBounds: true });
    assertTarget();
    const after = snapshot();
    if (!sameCanvasState(before, after)) throw new Error("Canvas state changed during render; retained nodes");
    send("result", { taskId: task.taskId, caseId: task.caseId, documentJson: JSON.stringify(document),
      areaId: area.id, rootNodeId: result.root.id, createdNodeIds: [area.id, ...area.findAll().map(node => node.id)],
      width: result.root.width, height: result.root.height, warnings: result.warnings, imagePaints,
      before, after, pngBase64: figma.base64Encode(png) });
    caseIndex++;
    busy = false;
  } catch (error) {
    send("failure", { error: String(error).slice(0, 4000), areaId: area?.id,
      createdNodeIds: area ? [area.id, ...area.findAll().map(node => node.id)] : [],
      observedFileKey: figma.fileKey, observedState: snapshot() });
  }
};
