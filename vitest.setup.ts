import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Este setup corre para TODOS los archivos de prueba, incluidos los que
// usan el entorno "node" (lib/**, route handlers) donde no hay `document`.
// El auto-cleanup de Testing Library depende de un global `afterEach` que
// Vitest no expone salvo `test.globals: true` (no lo activamos, para no
// ensuciar el scope de todos los archivos) — así que sin esto, un `render()`
// se queda pegado en el documento entre pruebas de un mismo archivo.
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
  });
}
