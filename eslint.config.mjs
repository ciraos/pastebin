import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Client pages intentionally load data in effects (the route handlers are
      // the source of truth and pages are static shells). The React Compiler
      // rule flags the synchronous loading-state updates these effects need.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local, non-project tooling: portable PostgreSQL and its bundled pgAdmin.
    ".pg/**",
    "data/**",
  ]),
]);

export default eslintConfig;
