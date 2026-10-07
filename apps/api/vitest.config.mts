import { defineConfig } from 'vitest/config';

process.env.NODE_ENV ??= 'test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
