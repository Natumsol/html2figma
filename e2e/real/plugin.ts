import { render } from "html2figma/render";
import { parseDocumentJson } from "../../example/figma-plugin/src/shared/document";
import { record, sameCanvasState, type CanvasState, type CleanupTask, type PluginConfig } from "./protocol";
import { createTransport } from "./transport";

declare const __REAL_CONFIG__: PluginConfig;
const config = __REAL_CONFIG__;
const columnWidth = Math.max(360, ...config.cases.map(entry => entry.width + 40));
const rowHeight = Math.max(220, ...config.cases.map(entry => entry.height + 40));
const markerKey = "html2figma-real-binding-v1";
const ownerKey = "html2figma-real-owner";
const caseKey = "html2figma-real-case";
const pluginSession = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let readyState: CanvasState | undefined;
let busy = false;
let caseIndex = 0;
let area: FrameNode | undefined;
const passedRoots: CleanupTask["roots"] = [];

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
      const size = await image.getSizeAsync();
      if (size.width <= 0 || size.height <= 0) throw new Error(`Image paint has invalid dimensions on node ${node.id}`);
      paints.push({ nodeId: node.id, imageHash: fill.imageHash, byteLength: bytes.length,
        sourceWidth: size.width, sourceHeight: size.height,
        x: node.x, y: node.y, width: node.width, height: node.height, visible: node.visible });
    }
  }
  return paints;
}

figma.showUI(createTransport(config), { visible: false });
figma.ui.onmessage = async (value: unknown) => {
  let activeTask: Record<string, unknown> | undefined;
  let baselineNodeIds: Set<string> | undefined;
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
    activeTask = task;
    if (task.type === "cleanup-passed") {
      if (caseIndex !== config.cases.length || !area ||
          task.taskId !== `${config.identity.runId}:cleanup` || task.areaId !== area.id ||
          JSON.stringify(task.roots) !== JSON.stringify(passedRoots)) throw new Error("Unexpected cleanup task");
      assertTarget();
      const before = snapshot();
      if (!sameCanvasState(readyState, before)) throw new Error("Canvas changed before cleanup");
      if (area.parent?.id !== figma.currentPage.id || area.getPluginData(ownerKey) !== config.identity.areaTag ||
          area.children.length !== passedRoots.length ||
          area.children.some((node, index) => node.id !== passedRoots[index].rootNodeId)) {
        throw new Error("Owned area or root list changed; cleanup refused");
      }
      const descendants = area.findAll();
      const observed = new Set([area.id, ...descendants.map(node => node.id)]);
      const expectedIds = new Set(passedRoots.flatMap(root => root.createdNodeIds));
      if (observed.size !== expectedIds.size || [...observed].some(id => !expectedIds.has(id)) ||
          descendants.some(node => node.getPluginData(ownerKey) !== config.identity.areaTag)) {
        throw new Error("Owned node inventory changed; cleanup refused");
      }
      for (const root of passedRoots) {
        const node = area.children.find(child => child.id === root.rootNodeId);
        if (!node || node.type !== "FRAME" || node.getPluginData(caseKey) !== root.caseId ||
            [node, ...node.findAll()].some(child => child.getPluginData(caseKey) !== root.caseId)) {
          throw new Error(`Case ownership changed: ${root.caseId}`);
        }
      }
      const removedNodeIds = [area.id, ...descendants.map(node => node.id)];
      const topLevelBefore = figma.currentPage.children.map(node => node.id);
      area.remove();
      area = undefined;
      const topLevelAfter = figma.currentPage.children.map(node => node.id);
      const after = snapshot();
      if (!sameCanvasState(before, after)) throw new Error("Canvas changed during cleanup");
      send("cleanup-result", { taskId: task.taskId, areaId: task.areaId, removedNodeIds,
        topLevelBefore, topLevelAfter, before, after });
      busy = false;
      return;
    }
    const expected = config.cases[caseIndex];
    if (!expected || task.type !== "render-case" || task.caseId !== expected.name ||
        task.taskId !== `${config.identity.runId}:${expected.name}` ||
        task.documentJson !== expected.documentJson) throw new Error("Unexpected render task/input");
    assertTarget();
    const before = snapshot();
    if (!sameCanvasState(readyState, before)) throw new Error("Canvas changed since handshake");
    const document = parseDocumentJson(task.documentJson as string);
    baselineNodeIds = new Set(figma.currentPage.findAll().map(node => node.id));
    if (!area) {
      const x = Math.max(0, ...figma.currentPage.children.map(node => node.x + node.width)) + 200;
      area = figma.createFrame();
      area.name = `html2figma E2E — ${config.identity.runId}`;
      area.setPluginData(ownerKey, config.identity.areaTag);
      area.x = x; area.y = 100;
      area.resize(columnWidth * 4 + 20, Math.ceil(config.cases.length / 4) * rowHeight + 40);
      area.fills = []; area.clipsContent = false;
      send("area", { taskId: task.taskId, caseId: task.caseId, areaId: area.id });
    }
    const result = await render(document, { parent: area, x: (caseIndex % 4) * columnWidth,
      y: Math.floor(caseIndex / 4) * rowHeight, loadFonts: true });
    if (result.root.type !== "FRAME") throw new Error("Visual case root is not a frame");
    const rootNodes = [result.root, ...result.root.findAll()];
    for (const node of rootNodes) {
      node.setPluginData(ownerKey, config.identity.areaTag);
      node.setPluginData(caseKey, expected.name);
    }
    const createdNodeIds = [area.id, ...rootNodes.map(node => node.id)];
    const appeared = figma.currentPage.findAll().filter(node => !baselineNodeIds?.has(node.id));
    const allowed = new Set(createdNodeIds);
    if (appeared.some(node => !allowed.has(node.id))) throw new Error("Render created nodes outside the owned case");
    if (config.injectFailureCase === expected.name) throw new Error(`Injected render failure after node creation: ${expected.name}`);
    const imagePaints = await inspectImagePaints(result.root);
    if (imagePaints.length < (expected.minImagePaints ?? 0)) {
      throw new Error(`${expected.name}: expected at least ${expected.minImagePaints} image paints, received ${imagePaints.length}`);
    }
    const png = await result.root.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 1 },
      colorProfile: "SRGB", useAbsoluteBounds: true });
    assertTarget();
    const after = snapshot();
    if (!sameCanvasState(before, after)) throw new Error("Canvas state changed during render; retained nodes");
    // Echo the exact downloaded JSON after shared validation, preserving its byte identity.
    send("result", { taskId: task.taskId, caseId: task.caseId, documentJson: task.documentJson,
      areaId: area.id, rootNodeId: result.root.id, createdNodeIds,
      width: result.root.width, height: result.root.height, warnings: result.warnings, imagePaints,
      before, after, pngBase64: figma.base64Encode(png) });
    passedRoots.push({ caseId: expected.name, rootNodeId: result.root.id, createdNodeIds });
    caseIndex++;
    busy = false;
  } catch (error) {
    const baseline = baselineNodeIds;
    const newlyObservedNodeIds = baseline
      ? figma.currentPage.findAll().filter(node => !baseline.has(node.id)).map(node => node.id) : [];
    const cleanup = activeTask?.type === "cleanup-passed";
    send(cleanup ? "cleanup-failure" : "failure", { error: String(error).slice(0, 4000),
      taskId: activeTask?.taskId, caseId: activeTask?.caseId, areaId: area?.id ?? activeTask?.areaId,
      createdNodeIds: area ? [area.id, ...area.findAll().map(node => node.id)] : newlyObservedNodeIds,
      newlyObservedNodeIds, observedFileKey: figma.fileKey, observedState: snapshot() });
  }
};
