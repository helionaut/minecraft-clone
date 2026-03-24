import { defineConfig } from 'vitest/config';

import { resolveBasePath } from './build/basePath.ts';

export default defineConfig({
  base: resolveBasePath(),
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
