import type { PluginConfig } from "./protocol";

export function createTransport(config: PluginConfig): string {
  // Figma's Developer VM nests this window: event.source !== parent is valid.
  // Only the observed Figma origin and this frozen run identity may send events.
  return `<!doctype html><html><body><script>
const config=${JSON.stringify(config).replaceAll("<", "\\u003c")};
let started=false;
let delivery=Promise.resolve();
async function claim(message) {
 const task=await (await post('claim',message)).json();
 parent.postMessage({pluginMessage:{type:'execute',runId:config.identity.runId,task}},'*');
}
async function post(route,body) {
 const response=await fetch('http://localhost:5173/bridge/'+config.token+'/'+route,{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
  signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw new Error('Bridge '+route+' HTTP '+response.status);
 return response;
}
window.addEventListener('message',event=>{
 if(event.origin!=='https://www.figma.com')return;
 const message=event.data?.pluginMessage;
 if(!message || message.bridge!=='html2figma-real' || message.runId!==config.identity.runId)return;
 delivery=delivery.then(async()=>{
  const response=await post(message.type,message);
  if(message.type==='ready' && !started) {
   started=true;
   await claim(message);
  }
  if(message.type==='result') {
   const receipt=await response.json();
   if(!receipt.complete) { await claim(message); return; }
  }
  if(message.type==='result' || message.type==='failure') {
   parent.postMessage({pluginMessage:{type:'receipt',runId:config.identity.runId}},'*');
  }
 }).catch(error=>console.error('E2E transport stopped; no retry',String(error)));
});
window.addEventListener('load',()=>parent.postMessage({pluginMessage:{type:'transport-ready',runId:config.identity.runId}},'*'),{once:true});
</script></body></html>`;
}
