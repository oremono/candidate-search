import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Component tests opt into jsdom with a `// @vitest-environment jsdom` first line.
    setupFiles: ['tests/setup-dom.ts'],
  },
});
