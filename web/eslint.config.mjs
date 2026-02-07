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
    // Custom ignores
    "scripts/**",
    "*.js",
    "**/*.js",
    "prisma/**/*.js",
    "coverage/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='toLocaleDateString']",
          message:
            "Não use toLocaleDateString diretamente. Use os helpers em src/lib/date.ts para evitar bugs de fuso horário.",
        },
      ],
    },
  },
]);

export default eslintConfig;
