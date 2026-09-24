import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createImageComparator } from "./images";
import { record, readCanvasState, sameCanvasState, type CanvasState, type CleanupTask, type Identity, type VisualCase } from "./protocol";

interface ReceiverOptions {
  output: string;
  token: string;
  identity: Identity;
  cases: VisualCase[];
  references: Map<string, Buffer>;
  port: number;
}
export interface RunState {
  status: "waiting" | "ready" | "claimed" | "rendered" | "cleanup-claimed" | "complete" | "failed" | "unknown";
  error?: string;
  results: Record<string, unknown>[];
  attempted: string[];
  unexecuted: string[];
  cleanup?: { status: "passed" | "failed" | "unknown"; areaId: string; removedNodeIds?: string[]; error?: string };
  failure?: Record<string, unknown>;
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers["content-type"] !== "application/json") throw new Error("Expected JSON");
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 12_000_000) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

export async function createReceiver(options: ReceiverOptions) {
  if (!options.cases.length || options.cases.some(entry => !options.references.has(entry.name))) throw new Error("Missing reference image");
  const state: RunState = { status: "waiting", results: [], attempted: [],
    unexecuted: options.cases.map(entry => entry.name) };
  let caseIndex = 0;
  let pluginSession: string | undefined;
  let readyState: CanvasState | undefined;
  let areaId: string | undefined;
  let sequence = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let imageComparator: Promise<Awaited<ReturnType<typeof createImageComparator>>> | undefined;
  let resolveFinished!: (state: RunState) => void;
  const finished = new Promise<RunState>(resolve => { resolveFinished = resolve; });
  let resolveRendered!: (state: RunState) => void;
  const rendered = new Promise<RunState>(resolve => { resolveRendered = resolve; });
  let renderedSettled = false;
  let releaseCleanup!: (authorized: boolean) => void;
  const cleanupGate = new Promise<boolean>(resolve => { releaseCleanup = resolve; });
  const terminal = () => ["complete", "failed", "unknown"].includes(state.status);
  const current = () => options.cases[caseIndex];
  const taskId = () => `${options.identity.runId}:${current().name}`;
  const snapshot = () => ({ ...state, results: [...state.results], attempted: [...state.attempted],
    unexecuted: [...state.unexecuted] });
  const settleRendered = () => { if (!renderedSettled) { renderedSettled = true; resolveRendered(snapshot()); } };
  const cleanupTask = (): CleanupTask => {
    if (!areaId || state.results.length !== options.cases.length ||
        state.results.some(result => result.status !== "passed")) throw new Error("Incomplete cleanup evidence");
    return { type: "cleanup-passed", taskId: `${options.identity.runId}:cleanup`, areaId,
      roots: state.results.map(result => ({ caseId: result.caseId as string,
        rootNodeId: result.rootNodeId as string, createdNodeIds: result.createdNodeIds as string[] })) };
  };
  async function journal(type: string, data: unknown) {
    const event = { sequence: ++sequence, time: new Date().toISOString(), type, data };
    await writeFile(join(options.output, `event-${String(sequence).padStart(4, "0")}.json`), JSON.stringify(event, null, 2), { flag: "wx" });
    await writeFile(join(options.output, "state.json"), JSON.stringify(state, null, 2));
  }
  async function fail(error: string, known = false) {
    if (terminal()) return;
    const prior = state.status;
    state.status = !known && ["claimed", "cleanup-claimed"].includes(prior) ? "unknown" : "failed";
    state.error = error;
    if (prior === "cleanup-claimed" && areaId) state.cleanup = { status: known ? "failed" : "unknown", areaId, error };
    try { await journal("failure", { error, unexecuted: state.unexecuted }); }
    finally { releaseCleanup(false); settleRendered(); resolveFinished(snapshot()); }
  }
  function verify(message: Record<string, unknown>) {
    for (const [key, expected] of Object.entries(options.identity)) {
      if (message[key] !== expected) throw new Error(`Identity mismatch: ${key}`);
    }
    if (typeof message.pluginSession !== "string" || !message.pluginSession || message.pluginSession.length > 200 ||
        (pluginSession && message.pluginSession !== pluginSession)) throw new Error("Plugin session mismatch");
  }
  await journal("waiting", { identity: options.identity, cases: options.cases.map(entry => ({ name: entry.name, sha256: entry.documentSha256 })) });
  const server = createServer(async (request, response) => {
    const route = new URL(request.url ?? "/", "http://localhost").pathname;
    const prefix = `/bridge/${options.token}/`;
    if (!route.startsWith(prefix)) { response.writeHead(404).end(); return; }
    if (!["null", "https://www.figma.com"].includes(request.headers.origin ?? "")) {
      response.writeHead(403).end("Origin rejected"); return;
    }
    response.setHeader("Access-Control-Allow-Origin", request.headers.origin!);
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
    if (request.method !== "POST") { response.writeHead(405).end(); return; }
    const action = route.slice(prefix.length);
    if (!["ready", "claim", "area", "result", "failure", "cleanup-result", "cleanup-failure"].includes(action)) { response.writeHead(404).end(); return; }
    let body: Record<string, unknown>;
    try { body = await readBody(request); }
    catch { response.writeHead(400).end("Invalid body"); return; }
    const handle = async () => {
      try {
        if (terminal()) { response.writeHead(409).end("Run is terminal"); return; }
        verify(body);
        if (action === "ready") {
          if (state.status !== "waiting") throw new Error("Already connected");
          readyState = readCanvasState(body.state);
          if (readyState.pageId !== options.identity.pageId) throw new Error("Wrong page");
          pluginSession = body.pluginSession as string;
          state.status = "ready";
          await journal("ready", body);
          response.end(JSON.stringify({ accepted: true }));
        } else if (action === "claim") {
          if (state.status !== "ready") { response.writeHead(409).end("Task unavailable"); return; }
          state.status = "claimed";
          state.attempted.push(current().name);
          state.unexecuted.shift();
          await journal("claimed", { taskId: taskId(), caseId: current().name });
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ type: "render-case", taskId: taskId(), caseId: current().name,
            documentJson: current().documentJson }));
        } else if (action === "failure") {
          if (typeof body.error !== "string" || body.error.length > 4000) throw new Error("Invalid failure");
          state.failure = body;
          await writeFile(join(options.output, `${current().name}.failure.json`), JSON.stringify(body, null, 2), { flag: "wx" });
          await journal("plugin-failure", body);
          await fail(`Plugin failure: ${body.error}`, true);
          response.end("saved");
        } else if (action === "cleanup-failure") {
          if (state.status !== "cleanup-claimed" || body.taskId !== `${options.identity.runId}:cleanup` ||
              body.areaId !== areaId || typeof body.error !== "string" || body.error.length > 4000) {
            throw new Error("Invalid cleanup failure");
          }
          await writeFile(join(options.output, "cleanup.failure.json"), JSON.stringify(body, null, 2), { flag: "wx" });
          await journal("cleanup-failure", body);
          await fail(`Cleanup failure: ${body.error}`, true);
          response.end("saved");
        } else if (action === "cleanup-result") {
          if (state.status !== "cleanup-claimed" || body.taskId !== `${options.identity.runId}:cleanup` ||
              body.areaId !== areaId || !Array.isArray(body.removedNodeIds) ||
              !body.removedNodeIds.every(id => typeof id === "string" && /^\d+:\d+$/.test(id))) {
            throw new Error("Invalid cleanup result");
          }
          const expected = new Set(cleanupTask().roots.flatMap(root => root.createdNodeIds));
          if (body.removedNodeIds.length !== expected.size || body.removedNodeIds.some(id => !expected.has(id))) {
            throw new Error("Cleanup removed-node inventory mismatch");
          }
          const topLevelBefore = body.topLevelBefore;
          const topLevelAfter = body.topLevelAfter;
          if (!Array.isArray(topLevelBefore) || !Array.isArray(topLevelAfter) ||
              ![...topLevelBefore, ...topLevelAfter].every(id => typeof id === "string" && /^\d+:\d+$/.test(id)) ||
              topLevelBefore.filter(id => id === areaId).length !== 1 ||
              JSON.stringify(topLevelBefore.filter(id => id !== areaId)) !== JSON.stringify(topLevelAfter)) {
            throw new Error("Cleanup changed unrelated top-level nodes");
          }
          const before = readCanvasState(body.before);
          const after = readCanvasState(body.after);
          if (!readyState || !sameCanvasState(readyState, before) || !sameCanvasState(before, after)) {
            throw new Error("Canvas state changed during cleanup");
          }
          await writeFile(join(options.output, "cleanup.result.json"), JSON.stringify(body, null, 2), { flag: "wx" });
          state.cleanup = { status: "passed", areaId: areaId!, removedNodeIds: body.removedNodeIds as string[] };
          await journal("cleanup-result", body);
          state.status = "complete";
          await journal("complete", { cleanup: state.cleanup });
          resolveFinished(snapshot());
          response.end(JSON.stringify({ accepted: true, complete: true }));
        } else {
          if (state.status !== "claimed" || body.taskId !== taskId() || body.caseId !== current().name) throw new Error("Unexpected task result");
          if (typeof body.areaId !== "string" || !/^\d+:\d+$/.test(body.areaId)) throw new Error("Invalid area identity");
          if (action === "area") {
            if (caseIndex !== 0 || areaId) throw new Error("Area already created");
            areaId = body.areaId;
            await journal("area-created", body);
            response.end("saved");
            return;
          }
          if (!areaId || body.areaId !== areaId || body.documentJson !== current().documentJson ||
              body.width !== current().width || body.height !== current().height ||
              !Array.isArray(body.warnings) ||
              JSON.stringify(body.warnings.map(warning => record(warning).code)) !== JSON.stringify(current().expectedWarningCodes) ||
              typeof body.rootNodeId !== "string" || !Array.isArray(body.createdNodeIds) ||
              !body.createdNodeIds.every(id => typeof id === "string" && /^\d+:\d+$/.test(id)) ||
              !body.createdNodeIds.includes(body.rootNodeId) || !body.createdNodeIds.includes(body.areaId)) {
            throw new Error("Invalid input, dimensions, warnings or nodes");
          }
          const before = readCanvasState(body.before);
          const after = readCanvasState(body.after);
          if (!readyState || !sameCanvasState(readyState, before) || !sameCanvasState(before, after)) throw new Error("Canvas state changed");
          if (typeof body.pngBase64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.pngBase64)) throw new Error("Invalid PNG encoding");
          const png = Buffer.from(body.pngBase64, "base64");
          const comparator = await (imageComparator ??= createImageComparator());
          const comparison = await comparator.compare(png, options.references.get(current().name)!,
            current().width, current().height, current().maxDiffPixelRatio);
          const name = current().name;
          await writeFile(join(options.output, `${name}-figma.png`), png, { flag: "wx" });
          const { pngBase64, ...result } = body;
          if (comparison?.diff) await writeFile(join(options.output, `${name}-diff.png`), comparison.diff, { flag: "wx" });
          const saved = { ...result, documentSha256: current().documentSha256,
            maxDiffPixelRatio: current().maxDiffPixelRatio, threshold: 0.2,
            visualError: comparison?.errorMessage ?? null, status: comparison ? "failed" : "passed" };
          await writeFile(join(options.output, `${name}.result.json`), JSON.stringify(saved, null, 2), { flag: "wx" });
          state.results.push(saved);
          await journal("result", saved);
          if (comparison) {
            await fail(`${name}: ${comparison.errorMessage}`, true);
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ accepted: false, aborted: true }));
            return;
          }
          caseIndex++;
          const complete = caseIndex === options.cases.length;
          state.status = complete ? "rendered" : "ready";
          await journal(complete ? "rendered" : "next-ready", { completed: name, next: complete ? null : current().name });
          if (complete) {
            settleRendered();
            const authorized = await cleanupGate;
            if (!authorized) { response.end(JSON.stringify({ accepted: false, aborted: true })); return; }
            state.status = "cleanup-claimed";
            await journal("cleanup-claimed", cleanupTask());
          }
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(complete ? { accepted: true, cleanupTask: cleanupTask() } : { accepted: true, complete: false }));
        }
      } catch (error) {
        if (state.status === "complete") state.status = "cleanup-claimed";
        await fail(String(error)).catch(() => {});
        response.writeHead(409).end("Protocol rejected; see local evidence");
      }
    };
    queue = queue.then(handle, handle);
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject); server.listen(options.port, "localhost", resolve);
  });
  return {
    url: `http://localhost:${(server.address() as AddressInfo).port}`,
    rendered,
    finished,
    async authorizeCleanup() {
      if (state.status !== "rendered") throw new Error("Rendering is not complete");
      await journal("cleanup-authorized", { taskId: `${options.identity.runId}:cleanup`, areaId });
      releaseCleanup(true);
    },
    async abortCleanup(reason: string) { await fail(reason, true); },
    async expire(reason: string) {
      if (state.status === "rendered") await fail(reason);
      else await (queue = queue.then(() => fail(reason)));
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await queue;
      await (await imageComparator)?.close();
    }
  };
}
