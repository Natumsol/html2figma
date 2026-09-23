// THROWAWAY: one sample, two real UI paths, one attempt per render. No retries.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../",import.meta.url));
const input = process.argv[2];
if (!input) throw new Error("Provide the prepared geometry.document.json path");
const scratch = mkdtempSync(join(tmpdir(),"html2figma-native-run-"));
const native = join(scratch,"ax");
const actions=[];
let output;
function exec(command,args) {
  const r=spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:45000,maxBuffer:4_000_000});
  // Do not copy document bytes or clipboard data into action logs.
  actions.push({time:new Date().toISOString(),command,args,status:r.status,error:r.error?.message,stderr:r.stderr});
  if(command===native && args[1]==="dump")writeFileSync(join(scratch,`ax-${actions.length}.json`),r.stdout);
  writeFileSync(join(scratch,"actions.json"),JSON.stringify(actions,null,2));
  if(r.status!==0) throw new Error(`${command} failed: ${r.stderr || r.stdout || r.error}`);
  return r.stdout.trim();
}
exec("swiftc",["e2e/prototype-desktop/ax.swift","-o",native]);
const pid=exec("pgrep",["-x","Figma"]);
if(!/^\d+$/.test(pid)) throw new Error("Expected exactly one running Figma process");
const receiver=spawn(process.execPath,["e2e/prototype-desktop/serve.mjs",resolve(input)],{cwd:root,stdio:["ignore","pipe","inherit"]});
let receiverFailure;
receiver.on("exit",code=>{receiverFailure=`Receiver exited ${code}`;});
let pending="";
receiver.stdout.on("data",chunk=>{
  pending+=chunk;
  let line;
  while((line=pending.indexOf("\n"))>=0) {
    const text=pending.slice(0,line);pending=pending.slice(line+1);console.log(text);
    try {const event=JSON.parse(text);if(event.status==="PACKAGE_READY")output=event.output;} catch {}
  }
});
const wait=async(check,label)=>{
  const end=Date.now()+15000;
  while(Date.now()<end) {
    if(receiverFailure)throw new Error(receiverFailure);
    const found=check();if(found)return found;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`Timed out waiting for ${label}; do not retry uncertain actions`);
};
const dump=()=>JSON.parse(exec(native,[pid,"dump"]));
const matches=(list,role,label)=>list.filter(e=>e.role===role && (e.AXTitle===label || e.AXDescription===label));
const one=(list,role,label)=>{const a=matches(list,role,label);if(a.length!==1)throw new Error(`Expected one ${role} ${label}, got ${a.length}`);return a[0];};
const label=e=>e.AXTitle??e.AXDescription??"";
const act=(action,e,extra=[])=>exec(native,[pid,action,e.path,e.role,label(e),...extra]);
const press=(role,name)=>act("press",one(dump(),role,name));
const state=()=>JSON.parse(readFileSync(join(output,"state.json"),"utf8"));
const shortcut=(expression)=>exec("osascript",["-e",`tell application "System Events" to tell process "Figma"
set frontmost to true
if not frontmost or name of window 1 is not "html2figma E2E 画布验收" or not (exists sheet 1 of window 1) then error "Picker not active"
${expression}
end tell`]);
try {
  await wait(()=>output,"receiver startup");
  exec("open",["-a","Figma","figma://file/3bfxbSZ7K2URZ3Aak50Wwd"]);
  press("AXPopUpButton","Main menu");
  press("AXMenuItem","Plugins");
  press("AXMenuItem","Development");
  press("AXMenuItem","html2figma Desktop Prototype");
  await wait(()=>state().events.find(e=>e.type==="ready"),"real plugin/file handshake");
  press("AXButton","Import JSON");
  press("AXButton","选择文件: 未选择任何文件");
  await wait(()=>dump().find(e=>e.AXIdentifier==="OKButton"),"native file picker");
  shortcut('keystroke "g" using {command down, shift down}');
  const pathField=await wait(()=>dump().find(e=>e.AXIdentifier==="PathTextField"),"Go to Folder field");
  act("set",pathField,[join(output,"geometry.document.json")]);
  shortcut("key code 36");
  await wait(()=>{const d=dump();return !d.some(e=>e.AXIdentifier==="PathTextField") && d.some(e=>e.AXValue==="geometry.document.json");},"selected JSON file");
  act("press",dump().find(e=>e.AXIdentifier==="OKButton"));
  await wait(()=>dump().find(e=>e.AXValue?.includes('"nodeCount": 5')),"actual file import summary");
  press("AXButton","Render to Figma");
  await wait(()=>state().results.includes("file"),"real file-import PNG receipt");
  const textArea=dump().filter(e=>e.role==="AXTextArea");
  if(textArea.length!==1)throw new Error("Ambiguous paste target");
  act("set",textArea[0],[""]);
  const pasted=act("paste",textArea[0],[join(output,"geometry.document.json")]);
  console.log(pasted);
  press("AXButton","Validate");
  await wait(()=>dump().find(e=>e.AXValue?.includes('"nodeCount": 5')),"paste validation summary");
  press("AXButton","Render to Figma");
  await wait(()=>state().results.includes("paste"),"real paste-import PNG receipt");
  writeFileSync(join(output,"native-actions.json"),JSON.stringify(actions,null,2));
  console.log(JSON.stringify({verdict:"PASS_TWO_REAL_UI_PATHS",output,actionEvidence:join(scratch,"actions.json"),results:state().results}));
} catch(error) {
  console.error(error);
  if(output)writeFileSync(join(output,"native-failure.json"),JSON.stringify({error:String(error),actions},null,2));
  process.exitCode=2;
} finally {
  // Leave the plugin and all created layers visible for inspection. Never retry.
  receiver.kill("SIGTERM");
}
