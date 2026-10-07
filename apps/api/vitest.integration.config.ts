import { defineConfig } from 'vitest/config';

process.env.NODE_ENV ??= 'test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 25000,
    hookTimeout: 25000,
    fileParallelism: false,
    maxConcurrency: 1,
    include: ['tests/**/*.test.ts'],
  },
});
