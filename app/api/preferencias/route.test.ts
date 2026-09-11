import { describe, expect, it } from "vitest";
import { esFiltrosReportes } from "./route";

describe("esFiltrosReportes", () => {
  it("acepta un objeto vacío — 'sin filtros' es una preferencia válida", () => {
    expect(esFiltrosReportes({})).toBe(true);
  });

  it("acepta solo las claves conocidas, todas como texto", () => {
    expect(esFiltrosReportes({ desde: "2026-01-01", zona: "abc", estatus: "Nuevo" })).toBe(
      true,
    );
  });

  it("rechaza una clave desconocida — no es un espacio libre para guardar cualquier cosa", () => {
    expect(esFiltrosReportes({ desde: "2026-01-01", otraCosa: "x" })).toBe(false);
  });

  it("rechaza un valor que no sea texto", () => {
    expect(esFiltrosReportes({ desde: 123 })).toBe(false);
    expect(esFiltrosReportes({ zona: null })).toBe(false);
  });

  it("rechaza tipos que no son objeto plano", () => {
    expect(esFiltrosReportes(null)).toBe(false);
    expect(esFiltrosReportes("texto")).toBe(false);
    expect(esFiltrosReportes(["desde"])).toBe(false);
  });
});
