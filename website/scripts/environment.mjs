export const productionOrigin = 'https://html2figma-one.vercel.app';

export function environmentName(env = process.env, fallback = 'production') {
  const name = env.SITE_ENV || env.VERCEL_ENV || fallback;
  if (!['development', 'preview', 'production'].includes(name)) {
    throw new Error('SITE_ENV must be development, preview or production.');
  }
  return name;
}

export function siteOrigin(env, name) {
  const origin = env.SITE_URL || (name === 'development'
    ? 'http://127.0.0.1:4321'
    : name === 'preview' && env.VERCEL_URL
      ? `https://${env.VERCEL_URL}`
      : productionOrigin);
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new Error('SITE_URL must be a valid HTTP(S) origin.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL must be an HTTP(S) origin without a path or credentials.');
  }
  return url.origin;
}

export function vercelPlan(action, target = 'preview', branch) {
  if (!['preview', 'production'].includes(target)) {
    throw new Error('Vercel target must be preview or production.');
  }
  if (!['env', 'build', 'deploy'].includes(action)) {
    throw new Error('Vercel action must be env, build or deploy.');
  }
  const branchArgs = target === 'preview' && branch ? [`--git-branch=${branch}`] : [];
  if (action === 'env') {
    return [['env', 'pull', `.env.${target}.local`, `--environment=${target}`, ...branchArgs, '--yes']];
  }
  const prodArgs = target === 'production' ? ['--prod'] : [];
  const plan = [
    ['pull', `--environment=${target}`, ...branchArgs, '--yes'],
    ['build', ...prodArgs],
  ];
  if (action === 'deploy') {
    const metadata = target === 'preview' && branch
      ? ['--meta', 'githubDeployment=1', '--meta', `githubCommitRef=${branch}`] : [];
    plan.push(['deploy', '--prebuilt', ...prodArgs, ...metadata]);
  }
  return plan;
}
