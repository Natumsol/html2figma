import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { vercelPlan } from './environment.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const [action, target = 'preview'] = process.argv.slice(2);
let project;
try {
  project = JSON.parse(readFileSync(join(root, '.vercel/project.json'), 'utf8'));
} catch {
  throw new Error('Link this website folder to the existing Vercel project before pulling or deploying.');
}
if (!project.projectId || !project.orgId) throw new Error('The local Vercel project link is incomplete.');
// Vercel resolves Root Directory relative to its CLI cwd, including output paths.
// Run builds from the repository root so `website` is applied exactly once.
const cwd = action === 'env' ? root : repositoryRoot;
if (cwd === repositoryRoot) {
  const linkFile = join(cwd, '.vercel/project.json');
  if (existsSync(linkFile)) {
    const existing = JSON.parse(readFileSync(linkFile, 'utf8'));
    if (existing.projectId !== project.projectId || existing.orgId !== project.orgId) {
      throw new Error('The repository root is linked to a different Vercel project.');
    }
  } else {
    mkdirSync(join(cwd, '.vercel'), { recursive: true });
    writeFileSync(linkFile, JSON.stringify({ projectId: project.projectId, orgId: project.orgId, projectName: project.projectName }));
  }
}
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
    cwd, stdio: 'inherit', env: { ...process.env, SITE_ENV: target },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  if (args[0] === 'pull') {
    const pulled = JSON.parse(readFileSync(join(cwd, '.vercel/project.json'), 'utf8'));
    if (pulled.settings?.rootDirectory !== 'website') {
      throw new Error('Set the Vercel project Root Directory to website before building or deploying.');
    }
  }
  if (args[0] === 'build') {
    // The local monorepo builder can report success with an empty static output.
    // Package the verified Astro dist while preserving CLI project/target metadata.
    const packaged = spawnSync(process.execPath, [join(root, 'scripts/prepare-vercel.mjs'), join(cwd, '.vercel/output')], {
      cwd: root, stdio: 'inherit',
    });
    if (packaged.error) throw packaged.error;
    if (packaged.status !== 0) process.exit(packaged.status || 1);
    if (!existsSync(join(cwd, '.vercel/output/static/index.html'))) {
      throw new Error('The build did not produce a deployable website homepage.');
    }
  }
}
