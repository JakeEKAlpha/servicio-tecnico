import { describe, expect, it, vi } from "vitest";
import { excedeLimite } from "./rateLimit";

describe("excedeLimite", () => {
  it("no excede mientras esté dentro del límite", () => {
    const clave = `t-${Math.random()}`;
    expect(excedeLimite(clave, 3, 60_000)).toBe(false); // intento 1
    expect(excedeLimite(clave, 3, 60_000)).toBe(false); // intento 2
    expect(excedeLimite(clave, 3, 60_000)).toBe(false); // intento 3
  });

  it("excede al pasarse del límite dentro de la misma ventana", () => {
    const clave = `t-${Math.random()}`;
    excedeLimite(clave, 2, 60_000); // 1
    excedeLimite(clave, 2, 60_000); // 2
    expect(excedeLimite(clave, 2, 60_000)).toBe(true); // 3 -> excede
  });

  it("claves distintas no se pisan entre sí", () => {
    const a = `t-${Math.random()}`;
    const b = `t-${Math.random()}`;
    excedeLimite(a, 1, 60_000);
    expect(excedeLimite(b, 1, 60_000)).toBe(false);
  });

  it("resetea el conteo una vez que vence la ventana", () => {
    vi.useFakeTimers();
    try {
      const clave = `t-${Math.random()}`;
      excedeLimite(clave, 1, 1_000);
      expect(excedeLimite(clave, 1, 1_000)).toBe(true);
      vi.advanceTimersByTime(1_001);
      expect(excedeLimite(clave, 1, 1_000)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
