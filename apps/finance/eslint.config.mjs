// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    "rules": {
      "no-restricted-syntax": [
        'error',
        {
          selector: "BinaryExpression[operator='+'] > Identifier[name=/amount|balance|centavos/]",
          message: 'Do not use + on monetary variables. Use money.add() from lib/money.ts',
        },
        {
          selector: "BinaryExpression[operator='-'] > Identifier[name=/amount|balance|centavos/]",
          message: 'Do not use - on monetary variables. Use money.subtract() from lib/money.ts',
        },
        {
          selector: "BinaryExpression[operator='*'] > Identifier[name=/amount|balance|centavos/]",
          message: 'Do not use * on monetary variables. Use money.multiply() from lib/money.ts',
        },
      ]
    }
  },
  ...storybook.configs["flat/recommended"]
]);

export default eslintConfig;
