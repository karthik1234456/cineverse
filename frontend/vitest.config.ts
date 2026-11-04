import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts', 'tests/unit/**/!(*ref_*).test.ts'],
    exclude: ['e2e/**/*', 'node_modules/**/*', 'tests/unit/ref_*'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
