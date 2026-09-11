import { describe, expect, it } from "vitest";
import { normalizarNombreCuenta, mejorCoincidenciaCliente } from "./directorio";

describe("normalizarNombreCuenta", () => {
  it("quita acentos y pasa a mayúsculas", () => {
    expect(normalizarNombreCuenta("Compañía México")).toBe("COMPANIA MEXICO");
  });

  it("quita razón social (SA DE CV y variantes)", () => {
    expect(normalizarNombreCuenta("Tiendas Soriana SA de CV")).toBe(
      "TIENDAS SORIANA",
    );
  });

  it("quita puntuación y colapsa espacios", () => {
    expect(normalizarNombreCuenta("BBVA Bancomer, S.A., Institución de Banca Múltiple")).toBe(
      "BBVA BANCOMER INSTITUCION BANCA MULTIPLE",
    );
  });

  it("null/undefined dan cadena vacía", () => {
    expect(normalizarNombreCuenta(null)).toBe("");
    expect(normalizarNombreCuenta(undefined)).toBe("");
  });
});

describe("mejorCoincidenciaCliente", () => {
  const clientes = [
    { id: "1", nombre: "TIENDAS SORIANA SA DE CV" },
    { id: "2", nombre: "DHL METROPOLITAN LOGISTICS" },
    { id: "3", nombre: "AMGEN MEXICO SA DE CV" },
  ];

  it("da puntaje 100 en una coincidencia exacta (tras normalizar)", () => {
    const r = mejorCoincidenciaCliente(clientes, "Tiendas Soriana SA de CV");
    expect(r).toEqual({ id: "1", puntaje: 100 });
  });

  it("no confunde nombres de empresas distintas aunque compartan palabras", () => {
    // "DHL EXPRESS MEXICO" no debe emparejar con "DHL METROPOLITAN LOGISTICS"
    // — es exactamente el caso real que motivó esta función.
    const r = mejorCoincidenciaCliente(clientes, "DHL EXPRESS MEXICO");
    expect(r).toBeNull();
  });

  it("devuelve null si el objetivo es demasiado corto para confiar en él", () => {
    expect(mejorCoincidenciaCliente(clientes, "AB")).toBeNull();
  });

  it("devuelve null si no hay ningún cliente con puntaje suficiente", () => {
    expect(mejorCoincidenciaCliente(clientes, "Operadora OMX")).toBeNull();
  });

  it("devuelve null con lista de clientes vacía", () => {
    expect(mejorCoincidenciaCliente([], "Tiendas Soriana")).toBeNull();
  });
});
