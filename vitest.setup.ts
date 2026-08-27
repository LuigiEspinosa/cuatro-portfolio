import '@testing-library/jest-dom';

// `vitest.config.ts` sets `jsdom` for the suite, and a file may opt out of it
// with `// @vitest-environment node` when what it tests is not a component.
// `ops/__tests__/library-backup.test.ts` does exactly that, because it spawns
// bash. This setup still runs for those files, so the DOM shim is guarded
// rather than assumed.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}
