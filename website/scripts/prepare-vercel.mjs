import { cp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.vercel/output');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, 'dist'), resolve(output, 'static'), { recursive: true, force: true });
const routes = [
  { src: '/brand/(.*)', headers: { 'Access-Control-Allow-Origin': '*' }, continue: true },
  { src: '/downloads/(.*)', headers: { 'Content-Disposition': 'attachment' }, continue: true },
  { src: '/(.*)', headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }, continue: true }
];
async function visit(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await visit(resolve(directory, entry.name), `${prefix}/${entry.name}`);
    else if (entry.name === 'index.html') routes.push({ src: `${prefix || ''}/?`, dest: `${prefix}/index.html` });
  }
}
await visit(resolve(root, 'dist'));
routes.push({ handle: 'filesystem' }, { src: '/.*', status: 404, dest: '/404.html' });
await writeFile(resolve(output, 'config.json'), JSON.stringify({ version: 3, routes }, null, 2));
console.log('Prepared Vercel Build Output API v3 static artifact.');
