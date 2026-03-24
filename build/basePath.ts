export function normalizeBasePath(value?: string): string {
  if (!value) {
    return '/';
  }

  const trimmed = value.trim();

  if (trimmed === '' || trimmed === '/') {
    return '/';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

export function resolveBasePath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return normalizeBasePath(env.VITE_BASE_PATH);
}
