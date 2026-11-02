import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    exclude: ['e2e/**/*', 'node_modules/**/*'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

