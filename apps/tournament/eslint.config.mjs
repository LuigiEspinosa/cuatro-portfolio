import next from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat ESLint config for Next 16 (replaces the removed `next lint`).
 * `core-web-vitals` + `typescript` mirrors the classic
 * `extends: ["next/core-web-vitals", "next/typescript"]` preset.
 *
 * @type {import("eslint").Linter.Config[]}
 */
const eslintConfig = [
  // Scope linting to the Next.js app: skip BMad planning artifacts, Supabase
  // SQL/tests, and any PoC code. (`node_modules`, `.next`, `out`, `build`,
  // and `next-env.d.ts` are already ignored by eslint-config-next.)
  {
    ignores: ["_bmad/**", "_bmad-output/**", "supabase/**"],
  },
  ...next,
  ...nextTypescript,
  // Honor the repo's `_`-prefix convention for intentionally-unused bindings
  // (e.g. required-but-unused function params like `(_table) => ...`).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
