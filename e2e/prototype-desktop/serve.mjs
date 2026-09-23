// THROWAWAY: actual product UI + actual renderer; only observe, isolate and export.
import { build } from "esbuild";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const runId = randomUUID();
const token = randomUUID();
const output = resolve(root, "test-results/desktop-prototype", runId);
const pluginDirectory = resolve(root, "test-results/desktop-prototype/plugin");
const ui = resolve(root, "example/figma-plugin/dist/ui");
const sha = value => createHash("sha256").update(value).digest("hex");
const apiMode = process.argv.includes("--api");
const inputPath = process.argv.slice(2).find(argument => argument !== "--api");
if (!inputPath) throw new Error("Pass a prepared geometry.document.json path");
const input = await readFile(inputPath, "utf8");
const expectedDocument = JSON.stringify(JSON.parse(input));
const rendererPath = resolve(root, "dist/render.js");
const rendererHash = sha(await readFile(rendererPath));
await readFile(resolve(ui, "index.html"));
await mkdir(output, { recursive: true });
await mkdir(pluginDirectory, { recursive: true });
await writeFile(resolve(output, "geometry.document.json"), input);

const constants = { runId, token, expectedDocument, rendererHash };
const banner = `const PROTOTYPE = ${JSON.stringify(constants)};`;
// The original product entry still receives the original UI message and calls
// render(). An import wrapper changes only the parent and observes the result.
const wrapper = `${banner}
import { render as actualRender } from ${JSON.stringify(rendererPath)};
export const context = { source: null, attempted: {}, area: null, taskId: null };
export function send(event) { figma.ui.postMessage({ prototype: true, runId: PROTOTYPE.runId, ...event }); }
export async function inspect() {
  const snapshot = { fileKey: figma.fileKey, pageId: figma.currentPage.id,
    pageName: figma.currentPage.name, existing: figma.currentPage.children.map(n => ({id:n.id,name:n.name,
      descendants:n.name.startsWith("PROTOTYPE — desktop ") && 'findAll' in n ? n.findAll().map(c=>({id:c.id,name:c.name})) : undefined})) };
  if (figma.fileKey !== "3bfxbSZ7K2URZ3Aak50Wwd") throw new Error("Wrong or unavailable fileKey; no writes allowed");
  return snapshot;
}
export async function render(document, options) {
  await inspect();
  if (JSON.stringify(document) !== PROTOTYPE.expectedDocument) throw new Error("Unexpected UI input; no writes allowed");
  const source = context.source;
  if (!${JSON.stringify(apiMode ? ["api"] : ["file", "paste"])}.includes(source) || context.attempted[source]) throw new Error("Unexpected or repeated source");
  context.attempted[source] = true;
  if (!context.area) {
    const x = Math.max(0, ...figma.currentPage.children.map(n => n.x + n.width)) + 200;
    context.area = figma.createFrame();
    context.area.name = "PROTOTYPE — desktop " + PROTOTYPE.runId;
    context.area.x = x; context.area.y = 100; context.area.resize(900, 600);
    context.area.fills = []; context.area.clipsContent = false;
    send({type:"area-created", areaId:context.area.id});
  }
  try {
    const result = await actualRender(document, {...options, parent:context.area, x:source === "file" ? 0 : 400,y:0});
    const png = await result.root.exportAsync({format:"PNG",constraint:{type:"SCALE",value:1},colorProfile:"SRGB",useAbsoluteBounds:true});
    send({type:"result",source,taskId:context.taskId,rendererHash:PROTOTYPE.rendererHash,document:JSON.stringify(document),
      areaId:context.area.id,rootNodeId:result.root.id,createdNodeIds:[result.root.id,...('findAll' in result.root ? result.root.findAll().map(n=>n.id):[])],
      width:result.root.width,height:result.root.height,warnings:result.warnings,pngBase64:figma.base64Encode(png)});
    return result;
  } catch (error) {
    send({type:"failure",source,error:String(error),areaId:context.area.id,
      createdNodeIds:context.area.findAll().map(n=>n.id)});
    throw error;
  }
}`;
const shellSource = await readFile(resolve(root, "example/figma-plugin/src/plugin/ui-shell.ts"), "utf8");
const bridge = `<script>
const runId=${JSON.stringify(runId)};
let pollingStarted=false;
let delivery=Promise.resolve();
async function pollTask() {
 try {
  const response=await fetch('http://localhost:5173/prototype/${token}/task');
  if(response.status===204) {setTimeout(pollTask,1000);return;}
  if(!response.ok) throw new Error('Task HTTP '+response.status);
  const task=await response.json();
  parent.postMessage({pluginMessage:{type:'prototype-api-render',task}},'*');
  // A claimed task is never fetched or submitted again, even on a lost result.
 } catch(error) {console.error('Prototype task channel stopped',error);}
}
async function report(data) {
 const response=await fetch('http://localhost:5173/prototype/${token}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId,...data})});
 if(!response.ok) throw new Error('Receiver HTTP '+response.status);
}
window.addEventListener('message',event=>{
 if(event.origin!=='https://www.figma.com' || !event.data?.pluginMessage?.prototype) return;
 const data=event.data.pluginMessage;
 if(data.runId!==runId) return;
 delivery=delivery.then(async()=>{try {
  await report({type:'transport-observation',sourceIsParent:event.source===parent,sourceIsNull:event.source===null,origin:event.origin,replyType:data.type});
  await report(data);
  if(${apiMode} && data.type==='ready' && !pollingStarted) {pollingStarted=true;void pollTask();}
 } catch(error) { console.error('Prototype receipt failed',error); }});
});
report({type:'shell-loaded'}).catch(console.error);
const ready=()=>parent.postMessage({pluginMessage:{type:'prototype-ready'}},'*');
if(${apiMode})window.addEventListener('load',ready,{once:true});
else document.querySelector('iframe').addEventListener('load',ready,{once:true});
</script>`;
const entry = apiMode ? `import { context, inspect, send, render } from 'prototype-renderer';
figma.showUI(${JSON.stringify('<!doctype html><html><body>'+bridge+'</body></html>')},{visible:false});
figma.ui.onmessage = async message => {
 try {
  if(message?.type==='prototype-ready') {send({type:'ready',mode:'api',...await inspect()});return;}
  if(message?.type!=='prototype-api-render')return;
  if(message.task?.type!=='render-geometry' || message.task?.taskId!==${JSON.stringify(runId+':api')})throw new Error('Unexpected API command');
  context.source='api';context.taskId=message.task.taskId;
  const before={selection:figma.currentPage.selection.map(n=>n.id),center:figma.viewport.center,zoom:figma.viewport.zoom};
  await render(message.task.document,{loadFonts:true});
  const after={selection:figma.currentPage.selection.map(n=>n.id),center:figma.viewport.center,zoom:figma.viewport.zoom};
  send({type:'api-observation',taskId:context.taskId,hiddenUI:true,before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)});
 } catch(error) {send({type:'failure',source:'api',error:String(error)});}
};` : `import ${JSON.stringify(resolve(root, "example/figma-plugin/src/plugin/main.ts"))};
import { context, inspect, send } from 'prototype-renderer';
const productHandler = figma.ui.onmessage;
figma.ui.onmessage = async (message, props) => {
 if (message?.type === 'prototype-ready') {
  try { send({type:'ready', ...await inspect()}); }
  catch(error) { send({type:'failure', error:String(error)}); }
  return;
 }
 if (message?.type !== 'render-json') return;
 context.source = message.source;
 await productHandler(message, props);
};`;
await build({
  stdin: { contents: entry, resolveDir: root, sourcefile: "prototype-entry.js" },
  bundle: true, format: "iife", target: "es2017", outfile: resolve(pluginDirectory, "main.js"),
  plugins: [{ name: "throwaway-observation", setup(b) {
    b.onResolve({filter:/^(html2figma\/render|prototype-renderer)$/}, () => ({path:"wrapper",namespace:"prototype"}));
    b.onLoad({filter:/.*/,namespace:"prototype"}, () => ({contents:wrapper,resolveDir:root,loader:"js"}));
    b.onLoad({filter:/\/src\/plugin\/ui-shell\.ts$/}, () => ({
      contents:shellSource.replace('    <script>','    '+bridge.replaceAll('`','\\`')+'\n    <script>'),
      loader:"ts"
    }));
  }}]
});
await writeFile(resolve(pluginDirectory, "manifest.json"), JSON.stringify({
  name:"html2figma Desktop Prototype",id:"html2figma-desktop-prototype",api:"1.0.0",
  main:"main.js",editorType:["figma"],documentAccess:"dynamic-page",enablePrivatePluginApi:true,
  networkAccess:{allowedDomains:["http://localhost:5173"],reasoning:"Throwaway local prototype UI and result receiver",devAllowedDomains:["http://localhost:5173"]}
}, null, 2));
await writeFile(resolve(output,"main.js"),await readFile(resolve(pluginDirectory,"main.js")));
const state = {runId,output,mode:apiMode?"api":"ui",pluginDirectory,pluginName:"html2figma Desktop Prototype",pluginSha256:sha(await readFile(resolve(output,"main.js"))),
  documentSha256:sha(expectedDocument),rendererHash,events:[],results:[]};
let pendingTask;
let commandIssued=false;
if(apiMode)await writeFile(resolve(output,"control.json"),JSON.stringify({commandUrl:`http://localhost:5173/prototype/${token}/command`},null,2));
const save = () => writeFile(resolve(output,"state.json"),JSON.stringify(state,null,2));
await save();
const server = createServer(async (req,res) => {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method === "OPTIONS") {res.writeHead(204).end();return;}
  const path = new URL(req.url,"http://localhost").pathname;
  if(apiMode && path===`/prototype/${token}/command` && req.method==="POST") {
    try {
      const chunks=[];let length=0;
      for await(const chunk of req){length+=chunk.length;if(length>1024)throw new Error("Command too large");chunks.push(chunk);}
      const command=JSON.parse(Buffer.concat(chunks));
      if(command.type!=="render-geometry" || Object.keys(command).length!==1 || commandIssued)throw new Error("Only one render-geometry command is permitted in this prototype session");
      commandIssued=true;pendingTask={type:"render-geometry",taskId:runId+":api",document:JSON.parse(expectedDocument)};
      state.queuedTaskId=pendingTask.taskId;await save();res.end(JSON.stringify({queuedTaskId:pendingTask.taskId}));
    } catch(error){res.writeHead(400).end(String(error));}
    return;
  }
  if(apiMode && path===`/prototype/${token}/task` && req.method==="GET") {
    if(!pendingTask || !state.events.some(event=>event.type==="ready" && event.fileKey==="3bfxbSZ7K2URZ3Aak50Wwd")){res.writeHead(204).end();return;}
    const task=pendingTask;pendingTask=undefined;state.claimedTaskId=task.taskId;await save();
    res.setHeader("Content-Type","application/json");res.end(JSON.stringify(task));return;
  }
  if(path === `/prototype/${token}` && req.method === "POST") {
    try {
      const chunks=[];let size=0;
      for await(const chunk of req) {size+=chunk.length;if(size>2_000_000) throw new Error("Oversize result");chunks.push(chunk);}
      const event=JSON.parse(Buffer.concat(chunks));
      if(event.runId!==runId || !["ready","result","area-created","failure","shell-loaded","transport-observation","api-observation"].includes(event.type)) throw new Error("Wrong event");
      if(event.type==="result") {
        if(!(apiMode?["api"]:["file","paste"]).includes(event.source) || state.results.includes(event.source) || event.rendererHash!==rendererHash || event.document!==expectedDocument || (apiMode && event.taskId!==state.claimedTaskId)) throw new Error("Wrong or duplicate result identity");
        const png=Buffer.from(event.pngBase64,"base64");
        if(png.subarray(0,8).toString("hex")!=="89504e470d0a1a0a" || png.readUInt32BE(16)!==event.width || png.readUInt32BE(20)!==event.height) throw new Error("Invalid PNG/dimensions");
        await writeFile(resolve(output,`${event.source}-figma.png`),png);
        state.results.push(event.source);
      }
      await writeFile(resolve(output,`event-${state.events.length}.json`),JSON.stringify(event,null,2));
      const {pngBase64,document,...summary}=event;
      state.events.push(summary);await save();console.log(JSON.stringify(summary));res.end("saved");
    } catch(error) {console.error(error);res.writeHead(400).end(String(error));}
    return;
  }
  const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".svg":"image/svg+xml"};
  try {
    const file=resolve(ui,decodeURIComponent(path.slice(1))||"index.html");
    if(!file.startsWith(ui+sep)) throw new Error("Path outside UI");
    const bytes=await readFile(file);res.setHeader("Content-Type",types[extname(file)]||"application/octet-stream");res.end(bytes);
  } catch {res.writeHead(404).end();}
});
await new Promise((yes,no)=>{server.once("error",no);server.listen(5173,"localhost",yes);});
console.log(JSON.stringify({status:"PACKAGE_READY",output,manifest:resolve(pluginDirectory,"manifest.json"),pluginName:state.pluginName}));
for(const signal of ["SIGINT","SIGTERM"]) process.on(signal,()=>server.close(()=>process.exit(0)));
