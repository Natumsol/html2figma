import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

function fixture(run) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'html2figma-vercel-')));
  const site = join(root, 'website');
  const project = { projectId: 'prj_fixture', orgId: 'team_fixture' };
  mkdirSync(join(site, 'scripts'), { recursive: true });
  mkdirSync(join(site, '.vercel'));
  mkdirSync(join(site, 'dist'));
  for (const file of ['vercel.mjs', 'environment.mjs', 'prepare-vercel.mjs']) {
    writeFileSync(join(site, 'scripts', file), readFileSync(new URL(file, import.meta.url)));
  }
  writeFileSync(join(site, '.vercel/project.json'), JSON.stringify(project));
  writeFileSync(join(site, 'dist/index.html'), '<!doctype html><title>Fixture</title>');
  writeFileSync(join(root, 'npm.mjs'), `
    import fs from 'node:fs';
    import path from 'node:path';
    const all = process.argv.slice(2);
    const args = all.slice(all.indexOf('vercel') + 1);
    fs.appendFileSync(process.env.TRACE_FILE, JSON.stringify({ cwd: process.cwd(), args }) + '\\n');
    if (args[0] === 'pull') {
      const file = '.vercel/project.json';
      const project = JSON.parse(fs.readFileSync(file));
      project.settings = { rootDirectory: process.env.PROJECT_ROOT || 'website' };
      fs.writeFileSync(file, JSON.stringify(project));
    }
    if (args[0] === 'build') {
      // Vercel resolves output relative to cwd + project Root Directory.
      const project = JSON.parse(fs.readFileSync('.vercel/project.json'));
      const output = path.resolve(process.cwd(), project.settings.rootDirectory, 'dist');
      if (!fs.existsSync(output)) process.exit(2);
      fs.mkdirSync('.vercel/output', { recursive: true });
      fs.writeFileSync('.vercel/output/builds.json', JSON.stringify({ target: 'preview' }));
    }
    if (args[0] === 'deploy' && !fs.existsSync('.vercel/output/static/index.html')) process.exit(3);
  `);
  spawnSync('git', ['init', '-b', 'feature/fixture'], { cwd: root, stdio: 'ignore' });
  const invoke = (action, target = 'preview', env = {}) => spawnSync(process.execPath,
    ['scripts/vercel.mjs', action, target], { cwd: site, encoding: 'utf8', env: {
      ...process.env, npm_execpath: join(root, 'npm.mjs'), TRACE_FILE: join(root, 'trace.jsonl'), ...env,
    } });
  const trace = () => readFileSync(join(root, 'trace.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  try { run({ root, site, project, invoke, trace }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test('prebuilt workflow applies the website Root Directory once from the repository root', () => fixture(({ root, project, invoke, trace }) => {
  const result = invoke('deploy');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(trace().map(call => [call.cwd, call.args[0]]), [
    [root, 'pull'], [root, 'build'], [root, 'deploy'],
  ]);
  const linked = JSON.parse(readFileSync(join(root, '.vercel/project.json')));
  assert.equal(linked.projectId, project.projectId);
  assert.equal(JSON.parse(readFileSync(join(root, '.vercel/output/builds.json'))).target, 'preview');
  assert.match(readFileSync(join(root, '.vercel/output/static/index.html'), 'utf8'), /Fixture/);
}));

test('dotenv pulls remain in the website directory', () => fixture(({ site, invoke, trace }) => {
  const result = invoke('env', 'development');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(trace()[0].cwd, site);
  assert.equal(trace()[0].args[2], '.env.development.local');
}));

test('incorrect remote Root Directory stops before build or upload', () => fixture(({ invoke, trace }) => {
  const result = invoke('deploy', 'production', { PROJECT_ROOT: 'wrong-directory' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Root Directory to website/);
  assert.deepEqual(trace().map(call => call.args[0]), ['pull']);
}));

test('an existing link to another project is preserved', () => fixture(({ root, invoke }) => {
  mkdirSync(join(root, '.vercel'));
  const file = join(root, '.vercel/project.json');
  const content = JSON.stringify({ projectId: 'prj_other', orgId: 'team_fixture' });
  writeFileSync(file, content);
  const result = invoke('deploy');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /different Vercel project/);
  assert.equal(readFileSync(file, 'utf8'), content);
}));
