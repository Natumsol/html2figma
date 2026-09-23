import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
async function setup(names = ["geometry"]) {
  const output = await mkdtemp(join(tmpdir(), "real-figma-test-"));
  cleanup.push(() => rm(output, { recursive: true, force: true }));
  const receiver = await createReceiver({ output, token: "secret", identity,
    cases: names.map(name => ({ name, documentJson: "{}", documentSha256: `hash-${name}`,
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
  expect((await post("result", result)).status).toBe(200);
  expect((await receiver.finished).status).toBe("complete");
  expect((await post("result", result)).status).toBe(409);
  expect(await readFile(join(output, "geometry-figma.png"))).toEqual(Buffer.from(result.pngBase64, "base64"));
  expect(JSON.parse(await readFile(join(output, "geometry.result.json"), "utf8"))).toMatchObject({ rootNodeId: "1:2" });
  const events = (await readdir(output)).filter(name => name.startsWith("event-"));
  expect(events).toEqual(["event-0001.json", "event-0002.json", "event-0003.json", "event-0004.json", "event-0005.json", "event-0006.json"]);
});

test("dispatches the second case only after the first result is saved", async () => {
  const { post, message, receiver, output } = await setup(["geometry", "flex-border"]);
  await post("ready", { ...message, state });
  expect((await (await post("claim", message)).json()).caseId).toBe("geometry");
  expect((await post("claim", message)).status).toBe(409);
  await post("area", { ...message, taskId: "run-1:geometry", caseId: "geometry", areaId: "1:1" });
  expect(await (await post("result", resultMessage(message))).json()).toMatchObject({ accepted: true, complete: false });
  expect((await (await post("claim", message)).json()).caseId).toBe("flex-border");
  expect(await (await post("result", resultMessage(message, "flex-border"))).json()).toMatchObject({ accepted: true, complete: true });
  expect(await receiver.finished).toMatchObject({ status: "complete", unexecuted: [], results: [{ caseId: "geometry" }, { caseId: "flex-border" }] });
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
  expect((await post("result", { ...resultMessage(message, "flex-reverse"),
    warnings: [{ code: "flex-layout-fallback" }] })).status).toBe(200);
  expect((await receiver.finished).status).toBe("complete");
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

function resultMessage(message: Record<string, unknown>, caseId = "geometry") {
  return { ...message, taskId: `run-1:${caseId}`, caseId, documentJson: "{}",
    areaId: "1:1", rootNodeId: "1:2", createdNodeIds: ["1:1", "1:2"],
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
