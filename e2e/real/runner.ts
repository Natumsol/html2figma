import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
import { record, type Identity } from "./protocol";
import { acquireLock, startReferenceServer, runBuild, lockPath, type Assets } from "./host";
import { prepareCases } from "./prepare";
import { prepareExtensionCases } from "./extension";
import { buildPlugin, assertNormalBuildIsolated, sha256 } from "./build";
import { createReceiver } from "./receiver";
import { writeReport } from "./report";

declare const __PROJECT_ROOT__: string;
const root = __PROJECT_ROOT__;
const directory = join(root, "test-results/real-figma");
const configPath = join(directory, "target.json");
const execFileAsync = promisify(execFile);
interface Target { fileKey: string; pageId: string; binding: string }
function readTarget(value: unknown): Target {
  const target = record(value);
  if (typeof target.fileKey !== "string" || !/^[A-Za-z0-9]+$/.test(target.fileKey) ||
      typeof target.pageId !== "string" || !/^\d+:\d+$/.test(target.pageId) ||
      typeof target.binding !== "string" || !target.binding) throw new Error("Invalid target configuration");
  return { fileKey: target.fileKey, pageId: target.pageId, binding: target.binding };
}
function observation(command: string, args: string[]): string {
  try { return execFileSync(command, args, { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return "unknown"; }
}
async function environment() {
  let browserInstalled = true;
  try { await access(chromium.executablePath()); } catch { browserInstalled = false; }
  return { platform: process.platform, node: process.version, browserInstalled,
    macOS: process.platform === "darwin" ? observation("sw_vers", ["-productVersion"]) : "not macOS",
    figmaVersion: observation("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleShortVersionString", "/Applications/Figma.app/Contents/Info.plist"]),
    figmaProcess: observation("pgrep", ["-x", "Figma"]) === "unknown" ? "not observed" : "running" };
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift() ?? "run";
  if (command === "report") {
    if (!args[0]) throw new Error("Pass a run directory to e2e:real:report");
    const file = resolve(args[0], "report.html"); await access(file); console.log(file); return;
  }
  if (command === "doctor") {
    const info = await environment();
    let target: Target | undefined;
    try { target = readTarget(JSON.parse(await readFile(configPath, "utf8"))); } catch { /* absent or invalid */ }
    let lockExists = false; try { await access(lockPath); lockExists = true; } catch { /* free */ }
    let portAvailable = true;
    try { const close = await startReferenceServer(new Map()); await close(); } catch { portAvailable = false; }
    console.log(JSON.stringify({ ...info, target: target ?? "not configured", lockExists, portAvailable,
      manifest: join(directory, "plugin/manifest.json"),
      next: "Runs open the bound Figma file and launch the imported plugin automatically. Use --manual-plugin to start it yourself after PACKAGE_READY. Live handshake is verified only during a run." }, null, 2));
    if (info.platform !== "darwin" || !info.browserInstalled || !target || lockExists || !portAvailable) process.exitCode = 2;
    return;
  }
  if (command !== "run") throw new Error("Use run, doctor or report");
  let bind = false; let fileKey: string | undefined; let pageId: string | undefined;
  let timeoutMs = 120_000; let injectFailureCase: string | undefined; let launchPlugin = true;
  while (args.length) {
    const flag = args.shift();
    if (flag === "--bind") bind = true;
    else if (flag === "--file-key") fileKey = args.shift();
    else if (flag === "--page-id") pageId = args.shift();
    else if (flag === "--timeout-ms") timeoutMs = Number(args.shift());
    else if (flag === "--inject-failure-case") injectFailureCase = args.shift();
    else if (flag === "--launch-plugin") launchPlugin = true;
    else if (flag === "--manual-plugin") launchPlugin = false;
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600_000) throw new Error("Timeout must be 1000–600000 ms");
  if (!bind && (fileKey || pageId)) throw new Error("Target changes require explicit --bind");
  const info = await environment();
  if (info.platform !== "darwin" || !info.browserInstalled || (!launchPlugin && info.figmaProcess !== "running")) {
    throw new Error("Run doctor: macOS and Chromium must be available; manual runs also require Figma to be running");
  }
  const release = await acquireLock();
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.once("SIGINT", interrupt); process.once("SIGTERM", interrupt);
  let closeReference: (() => Promise<void>) | undefined;
  let receiver: Awaited<ReturnType<typeof createReceiver>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let output: string | undefined;
  let summary: Record<string, unknown> = { status: "failed", environment: info };
  try {
    await mkdir(directory, { recursive: true });
    let target: Target;
    if (bind) {
      target = readTarget({ fileKey, pageId, binding: randomUUID() });
      let saved: Target | undefined;
      try { saved = readTarget(JSON.parse(await readFile(configPath, "utf8"))); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      if (saved) {
        if (saved.fileKey !== fileKey || saved.pageId !== pageId) throw new Error("Already bound to another target; use a separate checkout/configuration");
        target = saved;
      }
      // Persist the pending marker so interrupted first binding can be resumed explicitly.
      await writeFile(configPath, JSON.stringify(target, null, 2), { mode: 0o600 });
    } else {
      try { target = readTarget(JSON.parse(await readFile(configPath, "utf8"))); }
      catch { throw new Error("First run requires --bind --file-key KEY --page-id PAGE_ID"); }
    }
    const runId = randomUUID();
    output = join(directory, runId); await mkdir(output);
    summary = { ...summary, runId, target, launcher: launchPlugin ? "AppleScript" : "manual",
      coverage: "six visual and two extension cases; real plugin API; passed nodes cleaned after evidence" };
    if (launchPlugin) {
      const fileUrl = `figma://file/${target.fileKey}?node-id=${target.pageId.replace(":", "-")}`;
      await execFileAsync("open", ["-a", "Figma", fileUrl], { timeout: 15_000 });
      console.log(JSON.stringify({ status: "FIGMA_FILE_OPEN_REQUESTED", fileKey: target.fileKey, pageId: target.pageId }));
    }
    const files: Assets = new Map();
    closeReference = await startReferenceServer(files);
    await runBuild(root, abort.signal);
    await assertNormalBuildIsolated(root);
    const prepared = await prepareCases(root, output, files);
    const extensionPrepared = await prepareExtensionCases(root, output, files);
    const cases = [...prepared.cases, ...extensionPrepared.cases];
    if (injectFailureCase && !cases.some(entry => entry.name === injectFailureCase)) {
      throw new Error(`Unknown injected failure case: ${injectFailureCase}`);
    }
    const references = new Map([...prepared.references, ...extensionPrepared.references]);
    if (abort.signal.aborted) throw new Error("Interrupted during preparation");
    const identity: Identity = { protocol: 1, runId, buildId: "", ...target, areaTag: `html2figma:${runId}`,
      documentSha256: sha256(JSON.stringify(cases.map(entry => [entry.name, entry.documentSha256]))),
      converterSha256: prepared.converterSha256, rendererSha256: prepared.rendererSha256,
      extensionSha256: extensionPrepared.extensionSha256 };
    const token = randomUUID();
    const artifact = await buildPlugin(root, output, { identity, token, cases, bind, injectFailureCase });
    summary = { ...summary, environment: await environment(), identity, pluginSha256: artifact.pluginSha256, browserVersion: prepared.browserVersion,
      extensionBrowserVersion: extensionPrepared.browserVersion, injectFailureCase: injectFailureCase ?? null,
      cases: cases.map(({ documentJson, ...entry }) => entry) };
    await writeFile(join(output, "manifest.json"), JSON.stringify(summary, null, 2));
    await closeReference(); closeReference = undefined;
    receiver = await createReceiver({ output, token, identity, cases, references, port: 5173 });
    const activeReceiver = receiver;
    const expire = (reason: string) => { void activeReceiver.expire(reason).catch(error => console.error("Evidence write failed", String(error))); };
    abort.signal.addEventListener("abort", () => expire("Interrupted; no retry"), { once: true });
    timer = setTimeout(() => expire("Handshake/task timeout; check the current plugin launch after PACKAGE_READY. No retry."), timeoutMs);
    console.log(JSON.stringify({ status: "PACKAGE_READY", output, manifest: artifact.manifest, plugin: "html2figma Real E2E", timeoutMs,
      instruction: launchPlugin
        ? "AppleScript will open the already-imported plugin in Figma."
        : "Run the already-imported named plugin in the configured file. No automated clicks will be used." }));
    if (launchPlugin && !abort.signal.aborted) {
      try {
        await execFileAsync("osascript", [join(root, "e2e/real/launch-plugin.applescript")], { timeout: 75_000 });
        console.log(JSON.stringify({ status: "PLUGIN_LAUNCH_REQUESTED", plugin: "html2figma Real E2E" }));
      } catch (error) {
        throw new Error(`AppleScript could not launch the Figma plugin: ${String(error)}`);
      }
    }
    if (abort.signal.aborted) expire("Interrupted before plugin connection");
    const rendered = await receiver.rendered;
    summary = { ...summary, ...rendered };
    if (rendered.status !== "rendered") throw new Error(rendered.error ?? "Rendering did not finish");
    if (rendered.results.length !== cases.length || rendered.unexecuted.length) throw new Error("Incomplete eight-case render");
    await writeReport(output, { ...summary, status: "evidence-saved", threshold: 0.2 }, "report.before-cleanup");
    await receiver.authorizeCleanup();
    const state = await receiver.finished;
    summary = { ...summary, ...state };
    if (state.status !== "complete") throw new Error(state.error ?? "No real result");
    if (state.cleanup?.status !== "passed") throw new Error("Cleanup did not complete");
    summary = { ...summary, status: "passed", threshold: 0.2 };
  } catch (error) {
    try { await receiver?.abortCleanup(String(error)); }
    catch (cleanupError) { console.error("Cleanup abort evidence failed:", String(cleanupError)); }
    process.exitCode = 1;
    summary = { ...summary, status: summary.status === "unknown" ? "unknown" : "failed", error: String(error) };
    console.error(String(error));
  } finally {
    if (timer) clearTimeout(timer);
    // Evidence/report must exist even when setup, handshake or rendering fails.
    try { if (output) await writeReport(output, summary); }
    catch (error) { process.exitCode = 1; console.error("Report persistence failed:", String(error)); }
    try { await receiver?.close(); await closeReference?.(); }
    catch (error) { process.exitCode = 1; console.error("Service shutdown failed:", String(error)); }
    await release();
    process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt);
  }
  console.log(JSON.stringify({ status: summary.status, output, report: output && join(output, "report.html") }));
}
await main().catch(error => { console.error(String(error)); process.exitCode = 1; });
