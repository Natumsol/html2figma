// Fixed prototype command; never logs the local session credential.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
if (!process.argv[2]) throw new Error("Pass the run output directory printed by prototype:figma:api");
const directory = resolve(process.argv[2]);
const { commandUrl } = JSON.parse(await readFile(resolve(directory,"control.json"),"utf8"));
const url = new URL(commandUrl);
if (url.protocol!=="http:" || url.hostname!=="localhost" || url.port!=="5173" || !url.pathname.endsWith("/command")) throw new Error("Unexpected local command URL");
const response = await fetch(url, {
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({type:"render-geometry"})
});
const result = await response.text();
if (!response.ok) throw new Error(`Command rejected (${response.status}): ${result}`);
console.log(result);
