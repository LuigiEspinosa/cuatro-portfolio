import { defineConfig } from 'vitest/config';
import path from 'node:path';

// `@` resolves to the repo root, mirroring the tsconfig `paths` alias so tests can
// import `@/lib/...`. Tests run from the repo root (`npm test`), so cwd is the root.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd()),
      // `import 'server-only'` throws under plain Node — stub it so server-only modules
      // (lib/auth/session.ts, lib/auth/roles.ts, …) are unit-testable.
      'server-only': path.resolve(process.cwd(), 'test/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
