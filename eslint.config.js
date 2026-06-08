// @ts-check
// Flat config (ESLint 9). Entspricht 1:1 der früheren .eslintrc.json:
// - *.ts: @typescript-eslint/recommended + @angular-eslint/recommended,
//   Inline-Template-Processor, eigene fb-Selektor-Regeln, prefer-standalone/-inject aus.
// - *.html: @angular-eslint/template/recommended.
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = tseslint.config(
  {
    ignores: ["projects/**/*"],
  },
  {
    files: ["**/*.ts"],
    extends: [
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        project: ["tsconfig.json"],
      },
    },
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "fb",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "fb",
          style: "kebab-case",
        },
      ],
      "@angular-eslint/prefer-standalone": "off",
      "@angular-eslint/prefer-inject": "off",
    },
  },
  {
    files: ["**/*.html"],
    extends: [...angular.configs.templateRecommended],
    rules: {},
  }
);
