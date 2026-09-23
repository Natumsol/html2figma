// THROWAWAY feasibility probe. No canvas writes, permission changes, or retries.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const output = mkdtempSync(join(tmpdir(), "html2figma-desktop-probe-"));
const state = {
  prototype: true,
  startedAt: new Date().toISOString(),
  output,
  acceptanceFile: "https://www.figma.com/design/3bfxbSZ7K2URZ3Aak50Wwd",
  targetRole: "Historical acceptance file from e2e/visual/ACCEPTANCE.md; live identity UNVERIFIED",
  verdict: "IN_PROGRESS",
  observations: [],
  desktopCoverage: {
    targetFileVerified: false,
    namedPluginLaunched: false,
    realFileImport: false,
    realPasteImport: false,
    actualRender: false,
    pngExport: false,
    localhostReceipt: false,
    repeatability: false
  },
  createdNodeIds: []
};

function save() {
  writeFileSync(join(output, "state.json"), JSON.stringify(state, null, 2));
  console.log(JSON.stringify(state, null, 2));
}

function observe(label, command, args, timeout = 15000) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout, maxBuffer: 1024 * 1024 });
  const observation = {
    label, command: [command, ...args], status: result.status,
    signal: result.signal, error: result.error?.message,
    stdout: result.stdout?.trim(), stderr: result.stderr?.trim()
  };
  state.observations.push(observation);
  save();
  return observation;
}

observe("macOS", "sw_vers", []);
observe("Figma version", "/usr/libexec/PlistBuddy", [
  "-c", "Print :CFBundleShortVersionString", "/Applications/Figma.app/Contents/Info.plist"
]);
const process = observe("Figma process", "pgrep", ["-x", "Figma"]);
const permission = observe("System Events accessibility", "osascript", [
  "-e", 'tell application "System Events" to get UI elements enabled'
]);
if (permission.status !== 0 || permission.stdout !== "true") {
  state.verdict = "BLOCKED";
  state.nextAction = "Check a pending macOS Automation prompt for the invoking host. If denied, enable its System Events access in Privacy & Security > Automation. Enable Accessibility for the invoking host if needed. Do not automate consent. Rerun explicitly after the user acts.";
} else if (process.status !== 0) {
  state.verdict = "BLOCKED";
  state.nextAction = "Open Figma and sign in, then rerun explicitly.";
} else {
  const windows = observe("Figma window accessibility", "osascript", [
    "-e", 'tell application "System Events" to tell process "Figma" to get name of windows'
  ]);
  state.verdict = windows.status === 0 ? "PARTIAL" : "BLOCKED";
  state.nextAction = windows.status === 0
    ? "Read-only accessibility worked. Live target verification, plugin registration, UI imports, rendering and export still require a separate observed desktop run."
    : "Resolve the reported macOS permission failure before any desktop UI action.";
}
state.finishedAt = new Date().toISOString();
save();
// Even PARTIAL is not success for the complete feasibility question.
globalThis.process.exitCode = 2;
