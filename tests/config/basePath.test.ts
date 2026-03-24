import { describe, expect, it } from 'vitest';

import { normalizeBasePath, resolveBasePath } from '../../build/basePath.ts';

describe('normalizeBasePath', () => {
  it('defaults to the root path when unset', () => {
    expect(normalizeBasePath()).toBe('/');
    expect(normalizeBasePath('')).toBe('/');
    expect(normalizeBasePath('/')).toBe('/');
  });

  it('normalizes repository paths for static hosting', () => {
    expect(normalizeBasePath('minecraft-clone')).toBe('/minecraft-clone/');
    expect(normalizeBasePath('/minecraft-clone')).toBe('/minecraft-clone/');
    expect(normalizeBasePath('/minecraft-clone/')).toBe('/minecraft-clone/');
  });
});

describe('resolveBasePath', () => {
  it('reads the VITE_BASE_PATH environment variable', () => {
    expect(resolveBasePath({ VITE_BASE_PATH: 'preview' } as NodeJS.ProcessEnv)).toBe('/preview/');
  });
});
