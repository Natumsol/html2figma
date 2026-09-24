import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createReceiver } from "./receiver";

const cleanup: Array<() => Promise<unknown>> = [];
afterEach(async () => { for (const dispose of cleanup.splice(0).reverse()) await dispose(); });

const identity = {
  protocol: 1, runId: "run-1", buildId: "build-1", documentSha256: "input-1",
  converterSha256: "convert-1", rendererSha256: "render-1",
  fileKey: "file-1", pageId: "0:1", binding: "binding-1", areaTag: "area-1"
};
const state = { pageId: "0:1", selection: [], center: { x: 0, y: 0 }, zoom: 1 };
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=";
async function setup(names = ["geometry"], documentJson = "{}") {
  const output = await mkdtemp(join(tmpdir(), "real-figma-test-"));
  cleanup.push(() => rm(output, { recursive: true, force: true }));
  const receiver = await createReceiver({ output, token: "secret", identity,
    cases: names.map(name => ({ name, documentJson, documentSha256: `hash-${name}`,
      width: 1, height: 1, maxDiffPixelRatio: 0.001,
      expectedWarningCodes: name === "flex-reverse" ? ["flex-layout-fallback"] : [] })),
    references: new Map(names.map(name => [name, Buffer.from(png, "base64")])), port: 0 });
  cleanup.push(() => receiver.close());
  const message = { ...identity, pluginSession: "plugin-1" };
  const post = (route: string, payload: unknown) => fetch(`${receiver.url}/bridge/secret/${route}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "null" }, body: JSON.stringify(payload)
  });
  return { receiver, message, post, output };
}

async function finishAndClean(receiver: Awaited<ReturnType<typeof createReceiver>>,
  post: (route: string, payload: unknown) => Promise<Response>, message: Record<string, unknown>,
  result: Record<string, unknown>) {
  const pending = post("result", result);
  expect((await receiver.rendered).status).toBe("rendered");
  await receiver.authorizeCleanup();
  const reply = await pending;
  expect(reply.status).toBe(200);
  const receipt = await reply.json() as { cleanupTask: { areaId: string; roots: Array<{ createdNodeIds: string[] }> } };
  expect(receipt.cleanupTask.areaId).toBe("1:1");
  const removedNodeIds = [...new Set(receipt.cleanupTask.roots.flatMap(root => root.createdNodeIds))];
  expect((await post("cleanup-result", { ...message, taskId: "run-1:cleanup", areaId: "1:1",
    removedNodeIds, topLevelBefore: ["9:1", "1:1"], topLevelAfter: ["9:1"],
    before: state, after: state })).status).toBe(200);
  return receipt;
}

test("rejects a stale plugin before it can claim the render task", async () => {
  const { post, message } = await setup();
  expect((await post("ready", { ...message, buildId: "old-build", state })).status).toBe(409);
  expect((await post("claim", message)).status).toBe(409);
});

test("delivers a render task only once, even with simultaneous claims", async () => {
  const { post, message } = await setup();
  expect((await post("ready", { ...message, state })).status).toBe(200);
  const replies = await Promise.all([post("claim", message), post("claim", message)]);
  expect(replies.map(r => r.status).sort()).toEqual([200, 409]);
  expect((await post("claim", message)).status).toBe(409);
});

test("persists a valid PNG result and ignores attempts to complete twice", async () => {
  const { post, message, receiver, output } = await setup();
  await post("ready", { ...message, state });
  await post("claim", message);
  await post("area", { ...message, taskId: "run-1:geometry", caseId: "geometry", areaId: "1:1" });
  const result = resultMessage(message);
  await finishAndClean(receiver, post, message, result);
  expect((await receiver.finished).status).toBe("complete");
  expect((await post("result", result)).status).toBe(409);
  expect(await readFile(join(output, "geometry-figma.png"))).toEqual(Buffer.from(result.pngBase64, "base64"));
  expect(JSON.parse(await readFile(join(output, "geometry.result.json"), "utf8"))).toMatchObject({
    rootNodeId: "1:2", differentPixels: 0, actualDiffPixelRatio: 0
  });
  const events = (await readdir(output)).filter(name => name.startsWith("event-"));
  expect(events).toHaveLength(10);
});

test("acknowledges a saved visual failure so the plugin can close without cleanup", async () => {
  const { post, message, receiver, output } = await setup();
  await post("ready", { ...message, state });
  await post("claim", message);
  await post("area", { ...message, taskId: "run-1:geometry", caseId: "geometry", areaId: "1:1" });
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  let changedImage: Buffer;
  try {
    const page = await browser.newPage({ viewport: { width: 1, height: 1 }, deviceScaleFactor: 1 });
    await page.setContent('<body style="margin:0;background:#ff0000"></body>');
    changedImage = await page.screenshot();
  } finally {
    await browser.close();
  }

  const reply = await post("result", { ...resultMessage(message), pngBase64: changedImage.toString("base64") });
  expect(reply.status).toBe(200);
  expect(await reply.json()).toMatchObject({ accepted: false, aborted: true });
  expect(await receiver.finished).toMatchObject({ status: "failed", results: [{ status: "failed",
    differentPixels: 1, actualDiffPixelRatio: 1 }] });
  expect((await readdir(output)).some(name => name.startsWith("cleanup"))).toBe(false);
}, 15_000);

test("dispatches the second case only after the first result is saved", async () => {
  const { post, message, receiver, output } = await setup(["geometry", "flex-border"]);
  await post("ready", { ...message, state });
  expect((await (await post("claim", message)).json()).caseId).toBe("geometry");
  expect((await post("claim", message)).status).toBe(409);
  await post("area", { ...message, taskId: "run-1:geometry", caseId: "geometry", areaId: "1:1" });
  expect(await (await post("result", resultMessage(message))).json()).toMatchObject({ accepted: true, complete: false });
  expect((await (await post("claim", message)).json()).caseId).toBe("flex-border");
  await finishAndClean(receiver, post, message, resultMessage(message, "flex-border"));
  expect(await receiver.finished).toMatchObject({ status: "complete", unexecuted: [],
    cleanup: { status: "passed" }, results: [{ caseId: "geometry" }, { caseId: "flex-border" }] });
  expect((await readdir(output)).filter(name => name.endsWith("-figma.png"))).toEqual(["flex-border-figma.png", "geometry-figma.png"]);
});

test("keeps the completed case and lists unexecuted cases after a plugin failure", async () => {
  const { post, message, receiver, output } = await setup(["geometry", "flex-border", "media"]);
  await post("ready", { ...message, state });
  await post("claim", message);
  await post("area", { ...message, taskId: "run-1:geometry", caseId: "geometry", areaId: "1:1" });
  await post("result", resultMessage(message));
  await post("claim", message);
  expect((await post("failure", { ...message, error: "render stopped" })).status).toBe(200);
  expect(await receiver.finished).toMatchObject({ status: "failed", attempted: ["geometry", "flex-border"],
    unexecuted: ["media"],
    results: [{ caseId: "geometry", status: "passed" }] });
  expect((await post("result", resultMessage(message, "flex-border"))).status).toBe(409);
  expect((await readdir(output)).filter(name => name.endsWith("-figma.png"))).toEqual(["geometry-figma.png"]);
});

test("accepts exactly the expected fallback warning for a fallback case", async () => {
  const { post, message, receiver } = await setup(["flex-reverse"]);
  await post("ready", { ...message, state });
  await post("claim", message);
  await post("area", { ...message, taskId: "run-1:flex-reverse", caseId: "flex-reverse", areaId: "1:1" });
  await finishAndClean(receiver, post, message, { ...resultMessage(message, "flex-reverse"),
    warnings: [{ code: "flex-layout-fallback" }] });
  expect((await receiver.finished).status).toBe("complete");
});

test("preserves downloaded JSON bytes through extension task and result", async () => {
  const downloadedJson = '{\n  "version": 1\n}';
  const { post, message, receiver, output } = await setup(["extension-page"], downloadedJson);
  await post("ready", { ...message, state });
  expect((await (await post("claim", message)).json()).documentJson).toBe(downloadedJson);
  await post("area", { ...message, taskId: "run-1:extension-page", caseId: "extension-page", areaId: "1:1" });
  await finishAndClean(receiver, post, message, resultMessage(message, "extension-page", downloadedJson));
  expect((await receiver.finished).status).toBe("complete");
  expect(JSON.parse(await readFile(join(output, "extension-page.result.json"), "utf8")).documentJson).toBe(downloadedJson);
});

test("does not offer cleanup until all render evidence is saved and the runner authorizes it", async () => {
  const { post, message, receiver, output } = await setup();
  await post("ready", { ...message, state });
  await post("claim", message);
  await post("area", { ...message, taskId: "run-1:geometry", caseId: "geometry", areaId: "1:1" });
  const pending = post("result", resultMessage(message));
  expect(await receiver.rendered).toMatchObject({ status: "rendered", results: [{ status: "passed" }] });
  expect(await readFile(join(output, "geometry-figma.png"))).toEqual(Buffer.from(png, "base64"));
  expect((await readdir(output)).some(name => name.startsWith("cleanup"))).toBe(false);
  await receiver.abortCleanup("initial report write failed");
  expect(await pending.then(reply => reply.json())).toMatchObject({ aborted: true });
  expect(await receiver.finished).toMatchObject({ status: "failed", error: "initial report write failed" });
  expect((await readdir(output)).some(name => name.startsWith("cleanup"))).toBe(false);
});

test("rejects a cleanup result with missing nodes and cannot turn it into success", async () => {
  const { post, message, receiver, output } = await setup();
  await post("ready", { ...message, state });
  await post("claim", message);
  await post("area", { ...message, taskId: "run-1:geometry", caseId: "geometry", areaId: "1:1" });
  const pending = post("result", resultMessage(message));
  await receiver.rendered;
  await receiver.authorizeCleanup();
  expect((await pending).status).toBe(200);
  const bad = { ...message, taskId: "run-1:cleanup", areaId: "1:1", removedNodeIds: ["1:1"],
    topLevelBefore: ["9:1", "1:1"], topLevelAfter: ["9:1"], before: state, after: state };
  expect((await post("cleanup-result", bad)).status).toBe(409);
  expect(await receiver.finished).toMatchObject({ status: "unknown", cleanup: { status: "unknown" } });
  expect((await post("cleanup-result", { ...bad, removedNodeIds: ["1:1", "1:2"] })).status).toBe(409);
  expect((await readdir(output)).some(name => name === "cleanup.result.json")).toBe(false);
});

test("records a confirmed cleanup failure while retaining the render evidence", async () => {
  const { post, message, receiver, output } = await setup();
  await post("ready", { ...message, state });
  await post("claim", message);
  await post("area", { ...message, taskId: "run-1:geometry", caseId: "geometry", areaId: "1:1" });
  const pending = post("result", resultMessage(message));
  await receiver.rendered;
  await receiver.authorizeCleanup();
  expect((await pending).status).toBe(200);
  expect((await post("cleanup-failure", { ...message, taskId: "run-1:cleanup", areaId: "1:1",
    error: "owner tag changed", observedState: state })).status).toBe(200);
  expect(await receiver.finished).toMatchObject({ status: "failed", cleanup: { status: "failed" } });
  expect(JSON.parse(await readFile(join(output, "cleanup.failure.json"), "utf8"))).toMatchObject({ error: "owner tag changed" });
  expect(await readFile(join(output, "geometry-figma.png"))).toEqual(Buffer.from(png, "base64"));
});

test("rejects cleanup evidence that omits an unrelated top-level node", async () => {
  const { post, message, receiver } = await setup();
  await post("ready", { ...message, state });
  await post("claim", message);
  await post("area", { ...message, taskId: "run-1:geometry", caseId: "geometry", areaId: "1:1" });
  const pending = post("result", resultMessage(message));
  await receiver.rendered;
  await receiver.authorizeCleanup();
  expect((await pending).status).toBe(200);
  expect((await post("cleanup-result", { ...message, taskId: "run-1:cleanup", areaId: "1:1",
    removedNodeIds: ["1:1", "1:2"], topLevelBefore: ["9:1", "1:1"], topLevelAfter: [],
    before: state, after: state })).status).toBe(409);
  expect(await receiver.finished).toMatchObject({ status: "unknown", error: expect.stringContaining("unrelated top-level") });
});

test("stops before cleanup when a Figma PNG cannot be persisted", async () => {
  const { post, message, receiver, output } = await setup();
  await post("ready", { ...message, state });
  await post("claim", message);
  await post("area", { ...message, taskId: "run-1:geometry", caseId: "geometry", areaId: "1:1" });
  await writeFile(join(output, "geometry-figma.png"), "existing file", { flag: "wx" });
  expect((await post("result", resultMessage(message))).status).toBe(409);
  const finished = await receiver.finished;
  expect(finished.status).toBe("unknown");
  expect(finished.cleanup).toBeUndefined();
  expect((await readdir(output)).some(name => name.startsWith("cleanup"))).toBe(false);
  expect(await readFile(join(output, "geometry-figma.png"), "utf8")).toBe("existing file");
});

test.each(["protocol", "runId", "fileKey", "pageId", "binding", "documentSha256", "rendererSha256"])("rejects a mismatched %s before rendering", async field => {
  const { post, message } = await setup();
  expect((await post("ready", { ...message, [field]: "wrong", state })).status).toBe(409);
  expect((await post("claim", message)).status).toBe(409);
});

test("does not requeue a timed-out task or accept its late result", async () => {
  const { post, message, receiver } = await setup();
  await post("ready", { ...message, state });
  await post("claim", message);
  await post("area", { ...message, taskId: "run-1:geometry", caseId: "geometry", areaId: "1:1" });
  await receiver.expire("test timeout");
  expect(await receiver.finished).toMatchObject({ status: "unknown", error: "test timeout" });
  expect((await post("claim", message)).status).toBe(409);
  expect((await post("result", message)).status).toBe(409);
});

function resultMessage(message: Record<string, unknown>, caseId = "geometry", documentJson = "{}") {
  const rootNodeId = ({ geometry: "1:2", "flex-border": "1:3", "flex-reverse": "1:4",
    "extension-page": "1:5" } as Record<string, string>)[caseId] ?? "1:9";
  return { ...message, taskId: `run-1:${caseId}`, caseId, documentJson,
    areaId: "1:1", rootNodeId, createdNodeIds: ["1:1", rootNodeId],
    width: 1, height: 1, warnings: [], before: state, after: state,
    pngBase64: png };
}

test.each([
  { documentJson: "different input" },
  { width: 2 },
  { warnings: [{ code: "font-fallback" }] },
  { after: { ...state, selection: ["1:2"] } },
  { pngBase64: "corrupt" }
])("refuses invalid render evidence %j", async invalid => {
  const { post, message, receiver } = await setup();
  await post("ready", { ...message, state });
  await post("claim", message);
  await post("area", { ...message, taskId: "run-1:geometry", caseId: "geometry", areaId: "1:1" });
  expect((await post("result", { ...resultMessage(message), ...invalid })).status).toBe(409);
  expect((await receiver.finished).status).toBe("unknown");
});

test("rejects an untrusted origin without handing it the task", async () => {
  const { receiver, message, post } = await setup();
  const rejected = await fetch(`${receiver.url}/bridge/secret/ready`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://untrusted.example" },
    body: JSON.stringify({ ...message, state })
  });
  expect(rejected.status).toBe(403);
  expect((await post("ready", { ...message, state })).status).toBe(200);
  expect((await post("claim", message)).status).toBe(200);
});
