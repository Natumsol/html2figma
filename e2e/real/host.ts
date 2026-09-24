import { createServer } from "node:http";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

export type Assets = Map<string, { bytes: Buffer; contentType: string }>;
export const lockPath = join(tmpdir(), `html2figma-real-${process.getuid?.() ?? "user"}.lock`);

export async function acquireLock() {
  try { await mkdir(lockPath); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    throw new Error(`Real Figma run lock exists: ${lockPath}. Check its owner before manually removing a stale lock.`);
  }
  const owner = JSON.stringify({ pid: process.pid, nonce: randomUUID() });
  try { await writeFile(join(lockPath, "owner.json"), owner, { flag: "wx" }); }
  catch (error) { await rm(lockPath, { recursive: true, force: true }); throw error; }
  return async () => {
    if (await readFile(join(lockPath, "owner.json"), "utf8") === owner) await rm(lockPath, { recursive: true });
  };
}

export async function startReferenceServer(files: Assets) {
  const server = createServer((request, response) => {
    const item = files.get(new URL(request.url ?? "/", "http://localhost").pathname);
    if (!item || request.method !== "GET") { response.writeHead(404).end(); return; }
    response.writeHead(200, { "Content-Type": item.contentType, "Cache-Control": "no-store" }).end(item.bytes);
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(5173, "localhost", resolve); });
  return async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  };
}

export async function runBuild(root: string, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["run", "e2e:build"], { cwd: root, stdio: "inherit", detached: true });
    let stopped = false;
    const stop = () => {
      stopped = true;
      if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already exited */ } }
    };
    const timer = setTimeout(stop, 120_000);
    signal.addEventListener("abort", stop, { once: true });
    child.once("error", reject);
    child.once("close", code => {
      clearTimeout(timer); signal.removeEventListener("abort", stop);
      if (code === 0 && !stopped) resolve(); else reject(new Error(`Build failed or interrupted (${code})`));
    });
    if (signal.aborted) stop();
  });
}
