import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      // Provides a valid key for all tests that import lib/crypto.ts
      ENCRYPTION_KEY:
        "b2c80087a045112453054a988336ff2b1a26fe0a892fca07a64a9a4e802f8a34",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
