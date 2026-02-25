import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig(
  {
    name: "app/files-to-lint",
    files: [
      "**/*.{vue,ts,mts,tsx,js}",
    ],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "comma-spacing": [
        "error",
        { "before": false, "after": true },
      ],
      "space-in-parens": [
        "error",
        "never",
      ],
      "semi": [
        "error",
        "never",
      ],
      "quotes": [
        "error",
        "double",
      ],

      "function-call-argument-newline": [
        "warn",
        "consistent",
      ],
      "function-paren-newline": [
        "warn",
        "multiline",
      ],

      "padding-line-between-statements": [
        "warn",
        { blankLine: "always", prev: "*", next: "block-like" },
        { blankLine: "always", prev: "block-like", next: "*" },
        { blankLine: "always", prev: "*", next: "return" },
      ],


      "indent": [
        "error",
        2,
      ],

      "no-console": "warn",
      "no-debugger": "error",
      "prefer-const": "warn",
      "no-var": "error",
      "no-undef": "error",

      eqeqeq: [
        "error",
        "always",
      ],
      curly: [
        "error",
        "all",
      ],
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      camelcase: [
        "warn",
        { properties: "always" },
      ],

      "array-element-newline": [
        "warn",
        "always",
      ],
      "array-bracket-newline": [
        "warn",
        { "minItems": 1 },
      ],
      "brace-style": [
        "error",
        "stroustrup",
      ],
      "object-curly-newline": [
        "warn",
        {
          multiline: true,
          consistent: true,
        },
      ],
      "comma-dangle": [
        "warn",
        "always-multiline",
      ],


      "id-length": [
        "warn",
        {
          min: 2, exceptions: [
            "i",
            "j",
            "a",
            "b",
            "_",
            "e",
          ],
        },
      ],
      "max-len": [
        "warn",
        { code: 120, ignoreStrings: true, ignoreTemplateLiterals: true },
      ],
    },
  },

  globalIgnores([
    "**/dist/**",
    "**/dist-ssr/**",
    "**/coverage/**",
  ]),

)
