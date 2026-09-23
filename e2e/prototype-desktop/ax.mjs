// THROWAWAY native AX inspection/click helper. Never sends global keystrokes.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [action = "inspect", role = "", label = ""] = process.argv.slice(2);
if (!["inspect", "click"].includes(action) || /[\r\n]/.test(role + label)) throw new Error("Invalid action");
const quote = text => '"' + text.replaceAll("\\", "\\\\").replaceAll('"', '\\"') + '"';
const script = `tell application "System Events" to tell process "Figma"
if (count of windows) is 0 then error "Figma has no accessible window"
if name of window 1 is not "html2figma E2E 画布验收" then error "Unexpected Figma window"
set allElements to entire contents of window 1
set matchedElements to {}
set outputRows to {}
repeat with elem in allElements
 try
  set elementRole to role of elem
  if ${action === "inspect" ? "true" : "false"} and elementRole is not "AXGroup" and elementRole is not "AXImage" then
   set end of outputRows to {elementRole, name of elem, description of elem, value of elem}
  end if
  if elementRole is ${quote(role)} then
   if (name of elem is ${quote(label)}) or (description of elem is ${quote(label)}) then set end of matchedElements to contents of elem
  end if
 end try
end repeat
${action === "click" ? `if (count of matchedElements) is not 1 then error "Expected exactly one matching control"
set frontmost to true
click item 1 of matchedElements
return "Clicked observed control: " & ${quote(role + " " + label)}` : "return outputRows"}
end tell`;
const result = spawnSync("osascript", ["-e", script], { encoding: "utf8", timeout: 45000 });
const output = mkdtempSync(join(tmpdir(), "html2figma-ax-"));
const evidence = { action, role, label, status:result.status, error:result.error?.message, stdout:result.stdout, stderr:result.stderr };
writeFileSync(join(output,"observation.json"),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({output,...evidence},null,2));
process.exitCode = result.status === 0 ? 0 : 2;
