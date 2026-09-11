import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // Por defecto "node" — lib/** y los route handlers son lógica pura /
    // Request-Response estándar, corren más rápido sin DOM. Los archivos de
    // componentes piden jsdom ellos mismos con un comentario
    // `// @vitest-environment jsdom` en la primera línea.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "app/**/*.test.ts"],
  },
});
