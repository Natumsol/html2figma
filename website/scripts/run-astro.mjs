import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { environmentName } from './environment.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [command, requestedMode, ...args] = process.argv.slice(2);
if (!['dev', 'build'].includes(command)) throw new Error('Expected dev or build.');
const mode = requestedMode || environmentName(process.env, command === 'dev' ? 'development' : 'production');
environmentName({ SITE_ENV: mode });
const env = { ...process.env, SITE_ENV: mode };
for (const [script, scriptArgs] of [
  ['scripts/prepare-assets.mjs', []],
  ['node_modules/astro/bin/astro.mjs', [command, '--mode', mode, ...(command === 'dev' ? ['--host', '127.0.0.1', '--port', '4321'] : []), ...args]],
]) {
  const result = spawnSync(process.execPath, [script, ...scriptArgs], { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
