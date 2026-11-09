// `@testing-library/jest-dom/vitest` is the only entry point that augments Vitest's
// `Assertion` interface with the DOM matchers (`toBeInTheDocument`, `toHaveAttribute`
// and friends). It is loaded at runtime by the root `vitest.setup.ts`, but that file
// lives outside `apps/hub`, so it was never part of this app's own TypeScript program:
// `tsconfig.json` scopes `include` to this directory and pins `types` to
// `["vitest/globals"]`, which is an allow-list that stops @types being auto-loaded.
//
// The matchers therefore worked at runtime and had no types here. Next 16.1 did not
// type check these test files during `next build` and Next 16.4 does, which is what
// surfaced it as ~11 TS2339 errors rather than anything actually changing.
//
// `apps/tracker/tests/setup.ts` already imports this entry directly, which is why
// tracker never had the problem.
import "@testing-library/jest-dom/vitest";
