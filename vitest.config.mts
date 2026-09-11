import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // Solo lib/ por ahora — lógica pura sin dependencias de Next/React/Supabase.
    // Componentes y route handlers necesitan su propio setup (jsdom, mocks de
    // Supabase) y quedan para una siguiente ronda, no bloquean esta base.
    include: ["lib/**/*.test.ts"],
  },
});
