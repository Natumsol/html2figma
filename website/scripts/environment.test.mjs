import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadEnv } from 'vite';
import { environmentName, siteOrigin, productionOrigin, vercelPlan } from './environment.mjs';

test('explicit environment overrides Vercel; unsupported targets fail closed', () => {
  assert.equal(environmentName({}), 'production');
  assert.equal(environmentName({}, 'development'), 'development');
  assert.equal(environmentName({ VERCEL_ENV: 'preview' }), 'preview');
  assert.equal(environmentName({ SITE_ENV: 'preview', VERCEL_ENV: 'production' }), 'preview');
  assert.throws(() => environmentName({ SITE_ENV: 'staging' }));
});

test('origins follow the selected environment and explicit domain override', () => {
  assert.equal(siteOrigin({}, 'development'), 'http://127.0.0.1:4321');
  assert.equal(siteOrigin({}, 'production'), productionOrigin);
  assert.equal(siteOrigin({}, 'preview'), productionOrigin);
  assert.equal(siteOrigin({ VERCEL_URL: 'branch-project.vercel.app' }, 'preview'), 'https://branch-project.vercel.app');
  assert.equal(siteOrigin({ VERCEL_URL: 'branch-project.vercel.app' }, 'production'), productionOrigin);
  assert.equal(siteOrigin({ SITE_URL: 'https://custom.example/' }, 'preview'), 'https://custom.example');
  for (const SITE_URL of ['ftp://example.com', 'https://u:p@example.com', 'https://example.com/page', 'https://example.com/?token=x']) {
    assert.throws(() => siteOrigin({ SITE_URL }, 'production'));
  }
});

test('mode-specific dotenv values stay separate', () => {
  const root = mkdtempSync(join(tmpdir(), 'html2figma-env-'));
  try {
    writeFileSync(join(root, '.env.preview.local'), 'SITE_URL=https://preview.example\n');
    writeFileSync(join(root, '.env.production.local'), 'SITE_URL=https://production.example\n');
    // Isolate this test from the invoking shell's optional SITE_URL.
    const previous = process.env.SITE_URL;
    delete process.env.SITE_URL;
    try {
      assert.equal(siteOrigin(loadEnv('preview', root, ''), 'preview'), 'https://preview.example');
      assert.equal(siteOrigin(loadEnv('production', root, ''), 'production'), 'https://production.example');
    } finally {
      if (previous !== undefined) process.env.SITE_URL = previous;
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('default deployment pulls branch Preview variables and never uses --prod', () => {
  const plan = vercelPlan('deploy', undefined, 'feature/site');
  assert.deepEqual(plan[0], ['pull', '--environment=preview', '--git-branch=feature/site', '--yes']);
  assert.deepEqual(plan[1], ['build']);
  assert.deepEqual(plan[2], ['deploy', '--prebuilt', '--meta', 'githubDeployment=1', '--meta', 'githubCommitRef=feature/site']);
  assert.equal(plan.flat().includes('--prod'), false);
});

test('production flags apply to both build and deploy, with no Preview branch override', () => {
  assert.deepEqual(vercelPlan('deploy', 'production', 'feature/site'), [
    ['pull', '--environment=production', '--yes'], ['build', '--prod'], ['deploy', '--prebuilt', '--prod'],
  ]);
  assert.equal(vercelPlan('build', 'preview', 'feature/site').length, 2);
  assert.throws(() => vercelPlan('deploy', 'development'));
  assert.throws(() => vercelPlan('invalid', 'production'));
});

test('dotenv pull writes target-specific files, not shared .env.local', () => {
  assert.deepEqual(vercelPlan('env', 'preview', 'feature/site'), [
    ['env', 'pull', '.env.preview.local', '--environment=preview', '--git-branch=feature/site', '--yes'],
  ]);
  assert.deepEqual(vercelPlan('env', 'production'), [
    ['env', 'pull', '.env.production.local', '--environment=production', '--yes'],
  ]);
});
