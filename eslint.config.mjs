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
    // Tooling / subproyectos con su propio repo — no son código de esta app.
    ".claude/**",
    ".agents/**",
    "the-architect/**",
    "whatsapp-agentkit/**",
  ]),
]);

export default eslintConfig;
