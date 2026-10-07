import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores de eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefactos generados por next-pwa en build (sw.js, workbox-*, fallback-*,
    // swe-worker-*) — minificados y gitignored, no son código fuente.
    "public/**",
  ]),
]);

export default eslintConfig;
