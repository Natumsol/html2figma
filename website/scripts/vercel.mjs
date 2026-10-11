import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vercelPlan } from './environment.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [action, target = 'preview'] = process.argv.slice(2);
let project;
try {
  project = JSON.parse(readFileSync(join(root, '.vercel/project.json'), 'utf8'));
} catch {
  throw new Error('Link this website folder to the existing Vercel project before pulling or deploying.');
}
if (!project.projectId || !project.orgId) throw new Error('The local Vercel project link is incomplete.');
// Development only needs dotenv, without creating a deployment artifact.
let plan;
if (action === 'env' && target === 'development') {
  plan = [['env', 'pull', '.env.development.local', '--environment=development', '--yes']];
} else {
  const git = spawnSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' });
  if (git.error) throw git.error;
  const branch = git.stdout.trim();
  if (target === 'preview' && (!branch || git.status !== 0)) {
    throw new Error('Preview requires a checked-out Git branch for branch-specific environment variables.');
  }
  plan = vercelPlan(action, target, branch);
}
for (const args of plan) {
  // Keep deployment tooling out of the site's runtime and CI install graph.
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run this helper through its npm script.');
  const result = spawnSync(process.execPath, [npmCli, 'exec', '--yes', '--package=vercel@63.1.2', '--', 'vercel', ...args], {
    cwd: root, stdio: 'inherit', env: { ...process.env, SITE_ENV: target },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
