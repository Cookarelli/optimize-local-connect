import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Keep lint focused on maintained source, not framework and build artifacts.
  globalIgnores([
    "node_modules/**",
    ".next/**",
    ".output/**",
    ".vinext/**",
    ".wrangler/**",
    ".vercel/**",
    "coverage/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
