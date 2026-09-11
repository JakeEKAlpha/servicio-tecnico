import { describe, expect, it } from "vitest";
import { prioridadDe, prioridadServicio, ESTATUS_MANUALES } from "./estatus";

describe("prioridadDe", () => {
  it("los estatus accionables (asignado, listos por sistema) van primero", () => {
    expect(prioridadDe("Asignado")).toBe(1);
    expect(prioridadDe("Lista para realizar")).toBe(1);
    expect(prioridadDe("Listo para continuar")).toBe(1);
  });

  it("Concluido va al final de los estatus conocidos", () => {
    expect(prioridadDe("Concluido")).toBe(5);
  });

  it("un estatus desconocido (incluido Cancelado) cae al fondo, prioridad 9", () => {
    expect(prioridadDe("Cancelado")).toBe(9);
    expect(prioridadDe("algo-que-no-existe")).toBe(9);
  });

  it("null/undefined/vacío también caen al fondo", () => {
    expect(prioridadDe(null)).toBe(9);
    expect(prioridadDe(undefined)).toBe(9);
    expect(prioridadDe("")).toBe(9);
  });
});

describe("prioridadServicio", () => {
  it("Xerox siempre es nivel 2, sin importar el origen", () => {
    expect(prioridadServicio("WO", "Xerox", null)).toBe(2);
    expect(prioridadServicio(null, "xerox", "renta")).toBe(2);
  });

  it("WO Lexmark es nivel 1, SR Lexmark es nivel 3", () => {
    expect(prioridadServicio("WO", "Lexmark", null)).toBe(1);
    expect(prioridadServicio("SR", "Lexmark", null)).toBe(3);
  });

  it("servicios de Alpha Digital se ordenan por tipo de contrato", () => {
    expect(prioridadServicio("MANUAL", "Propio", "renta")).toBe(4);
    expect(prioridadServicio("MANUAL", "Propio", "garantia")).toBe(5);
    expect(prioridadServicio("MANUAL", "Propio", "poliza")).toBe(5);
    expect(prioridadServicio("MANUAL", "Propio", "tym")).toBe(6);
  });

  it("sin contrato vinculado y sin ser WO/SR/Xerox, cae al nivel 7", () => {
    expect(prioridadServicio("MANUAL", "Propio", null)).toBe(7);
  });
});

describe("ESTATUS_MANUALES", () => {
  it("no incluye los dos estatus que solo pone el sistema", () => {
    expect(ESTATUS_MANUALES).not.toContain("Lista para realizar");
    expect(ESTATUS_MANUALES).not.toContain("Listo para continuar");
  });

  it("sí incluye Concluido (gerencia también puede ponerlo manual)", () => {
    expect(ESTATUS_MANUALES).toContain("Concluido");
  });
});
