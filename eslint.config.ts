import type { Linter } from "eslint";

const config: Linter.Config[] = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/out/**",
      "**/.turbo/**",
      "packages/cli/vault/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
];

export default config;
