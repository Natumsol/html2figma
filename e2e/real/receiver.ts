import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { decodePng } from "./images";
import { record, readCanvasState, sameCanvasState, type CanvasState, type Identity } from "./protocol";

interface ReceiverOptions {
  output: string;
  token: string;
  identity: Identity;
  documentJson: string;
  width: number;
  height: number;
  port: number;
}
export interface RunState {
  status: "waiting" | "ready" | "claimed" | "complete" | "failed" | "unknown";
  error?: string;
  result?: Record<string, unknown>;
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers["content-type"] !== "application/json") throw new Error("Expected JSON");
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 2_000_000) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

export async function createReceiver(options: ReceiverOptions) {
  const state: RunState = { status: "waiting" };
  let pluginSession: string | undefined;
  let readyState: CanvasState | undefined;
  let sequence = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let resolveFinished!: (state: RunState) => void;
  const finished = new Promise<RunState>(resolve => { resolveFinished = resolve; });
  const terminal = () => ["complete", "failed", "unknown"].includes(state.status);
  async function journal(type: string, data: unknown) {
    const event = { sequence: ++sequence, time: new Date().toISOString(), type, data };
    await writeFile(join(options.output, `event-${String(sequence).padStart(4, "0")}.json`), JSON.stringify(event, null, 2), { flag: "wx" });
    await writeFile(join(options.output, "state.json"), JSON.stringify(state, null, 2));
  }
  async function fail(error: string) {
    if (terminal()) return;
    state.status = state.status === "claimed" ? "unknown" : "failed";
    state.error = error;
    try { await journal("failure", { error }); }
    finally { resolveFinished({ ...state }); }
  }
  function verify(message: Record<string, unknown>) {
    for (const [key, expected] of Object.entries(options.identity)) {
      if (message[key] !== expected) throw new Error(`Identity mismatch: ${key}`);
    }
    if (typeof message.pluginSession !== "string" || !message.pluginSession || message.pluginSession.length > 200 ||
        (pluginSession && message.pluginSession !== pluginSession)) throw new Error("Plugin session mismatch");
  }
  await journal("waiting", { identity: options.identity });
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
    if (!["ready", "claim", "area", "result", "failure"].includes(action)) { response.writeHead(404).end(); return; }
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
          await journal("claimed", { taskId: `${options.identity.runId}:geometry` });
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ type: "render-geometry", taskId: `${options.identity.runId}:geometry`, documentJson: options.documentJson }));
        } else if (action === "failure") {
          if (typeof body.error !== "string" || body.error.length > 4000) throw new Error("Invalid failure");
          await journal("plugin-failure", body);
          await fail(`Plugin failure: ${body.error}`);
          response.end("saved");
        } else {
          if (state.status !== "claimed" || body.taskId !== `${options.identity.runId}:geometry`) throw new Error("Unexpected task result");
          if (typeof body.areaId !== "string" || !/^\d+:\d+$/.test(body.areaId)) throw new Error("Invalid area identity");
          if (action === "area") {
            await journal("area-created", body);
            response.end("saved");
            return;
          }
          if (body.documentJson !== options.documentJson || body.width !== options.width || body.height !== options.height ||
              !Array.isArray(body.warnings) || body.warnings.length !== 0 ||
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
          decodePng(png, options.width, options.height);
          await writeFile(join(options.output, "geometry-figma.png"), png, { flag: "wx" });
          const { pngBase64, ...result } = body;
          await writeFile(join(options.output, "result.json"), JSON.stringify(result, null, 2), { flag: "wx" });
          // Do not publish a completed state until every result write succeeds.
          await journal("result", result);
          state.status = "complete";
          state.result = result;
          await writeFile(join(options.output, "state.json"), JSON.stringify(state, null, 2));
          resolveFinished({ ...state });
          response.end("saved");
        }
      } catch (error) {
        if (state.status === "complete") state.status = "claimed";
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
    finished,
    async expire(reason: string) { await (queue = queue.then(() => fail(reason))); },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await queue;
    }
  };
}
