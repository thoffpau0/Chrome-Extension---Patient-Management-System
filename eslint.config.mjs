// eslint.config.mjs
import globals from "globals";
import jsPlugin from "@eslint/js";
import prettierPlugin from "eslint-plugin-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Define global variables and parser options
  {
    languageOptions: {
      globals: {
        ...globals.browser,       // Existing browser globals
        chrome: "readonly",       // Add chrome as a readonly global
      },
      parserOptions: {
        ecmaVersion: 12,          // ECMAScript version
        sourceType: "module",     // Module type
      },
    },
  },

  // Include ESLint's recommended configurations
  jsPlugin.configs.recommended,

  // Integrate Prettier as a plugin
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      // Enable Prettier's recommended rule
      "prettier/prettier": "error",
    },
  },

  // Add any custom rules or overrides
  {
    rules: {
      // Example: Warn about console usage
      // "no-console": "warn",

      // Add more custom rules as needed
    },
  },
];
