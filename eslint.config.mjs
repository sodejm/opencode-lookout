/** Shared lint policy: all warnings block; public APIs need useful documentation. */
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      // Pinned compiler output is byte-checked by build:check and security-scanned.
      "dist/tui.js",
      ".build/**",
      "test-artifacts/**",
      "release-evidence/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  {
    files: ["**/*.{mjs,js,ts,tsx}"],
    languageOptions: { globals: globals.node },
    plugins: { jsdoc },
    rules: {
      "jsdoc/check-param-names": "error",
      "jsdoc/check-tag-names": ["error", { definedTags: ["internal"] }],
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
        },
      ],
    },
  },
];
