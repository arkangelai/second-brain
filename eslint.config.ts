import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/out/**",
      "**/.turbo/**",
      "**/*.tsbuildinfo",
      "packages/cli/vault/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "apps/web/src/app/**/page.{ts,tsx}",
      "apps/web/src/app/**/layout.{ts,tsx}",
      "apps/web/src/app/**/template.{ts,tsx}",
      "apps/web/src/app/**/loading.{ts,tsx}",
      "apps/web/src/app/**/error.{ts,tsx}",
      "apps/web/src/app/**/not-found.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "Service-role Supabase clients are restricted to Route Handlers and must not be imported by React Server Components.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/supabase/admin"],
              message:
                "Service-role Supabase clients are restricted to Route Handlers and must not be imported by React Server Components.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  }
);
