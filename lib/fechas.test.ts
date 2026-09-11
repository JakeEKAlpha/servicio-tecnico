import { describe, expect, it } from "vitest";
import { isoMx, horaMx } from "./fechas";

describe("isoMx", () => {
  it("formatea una fecha UTC a YYYY-MM-DD en horario de México", () => {
    // Medianoche UTC del 10 de septiembre es todavía 9 de septiembre en
    // México (UTC-6) — el punto de esta función es no equivocarse ahí.
    expect(isoMx(new Date("2026-09-10T00:00:00.000Z"))).toBe("2026-09-09");
  });

  it("una hora bien entrada la mañana UTC cae en el mismo día en México", () => {
    expect(isoMx(new Date("2026-09-10T18:00:00.000Z"))).toBe("2026-09-10");
  });
});

describe("horaMx", () => {
  it("formatea HH:MM:SS en 24 horas para el horario de México", () => {
    // 18:00 UTC = 12:00 en America/Mexico_City (UTC-6, sin horario de verano).
    expect(horaMx(new Date("2026-09-10T18:00:00.000Z"))).toBe("12:00:00");
  });
});
