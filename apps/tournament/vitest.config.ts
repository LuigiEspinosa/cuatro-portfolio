import { defineConfig } from 'vitest/config';
import path from 'node:path';

// `@` resolves to the repo root, mirroring the tsconfig `paths` alias so tests can
// import `@/lib/...`. Tests run from the repo root (`npm test`), so cwd is the root.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd()),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
