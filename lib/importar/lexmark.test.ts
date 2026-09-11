import { describe, expect, it } from "vitest";
import {
  detectarOrigen,
  esVacio,
  limpio,
  parsearReporteLexmark,
} from "./lexmark";

describe("detectarOrigen", () => {
  it("un número de 6+ dígitos es WO", () => {
    expect(detectarOrigen("12345678")).toBe("WO");
  });

  it("un número con prefijo 1- es SR", () => {
    expect(detectarOrigen("1-123456789012")).toBe("SR");
  });

  it("texto que no encaja en ninguno de los dos patrones da null", () => {
    expect(detectarOrigen("Work Order Number")).toBeNull();
    expect(detectarOrigen("")).toBeNull();
    expect(detectarOrigen("ABC123")).toBeNull();
  });
});

describe("esVacio / limpio", () => {
  it("trata '' y 'N/A' (cualquier caja) como vacío", () => {
    expect(esVacio("")).toBe(true);
    expect(esVacio("  ")).toBe(true);
    expect(esVacio("N/A")).toBe(true);
    expect(esVacio("n/a")).toBe(true);
    expect(esVacio("algo")).toBe(false);
  });

  it("limpio recorta espacios y convierte vacío/N-A en cadena vacía", () => {
    expect(limpio("  hola  ")).toBe("hola");
    expect(limpio("N/A")).toBe("");
    expect(limpio(undefined)).toBe("");
  });
});

/** Arma una fila de 28 columnas (COLS_CRUDOS) rellenando el resto con "". */
function filaCruda(valores: Record<number, string>): string {
  const fila = new Array(28).fill("");
  for (const [i, v] of Object.entries(valores)) fila[Number(i)] = v;
  return fila.join("\t");
}

describe("parsearReporteLexmark", () => {
  it("texto vacío da error, no una lista vacía silenciosa", () => {
    const r = parsearReporteLexmark("");
    expect(r.ok).toBe(false);
  });

  it("parsea una fila WO: cliente, contacto, dirección, estado y falla en el lugar correcto", () => {
    const fila = filaCruda({
      0: "12345678", // Work Order Number
      3: "SN123", // Serial Number
      6: "LaserPrinter", // Product -> modelo
      13: "Printer jam", // Work Order Summary -> falla (WO)
      15: "AUTOZONE MEXICO", // Service Account -> cliente
      16: "Juan Perez", // Onsite Contact -> contacto
      17: "555-1234", // Onsite Contact Phone # -> tel_movil
      19: "Street 1 Value",
      20: "Street 2 Value",
      21: "Tapachula", // City -> localidad
      22: "Mexico | Chiapas", // State-Province -> estado (se quita el prefijo "Mexico |")
      27: "Building1",
    });

    const r = parsearReporteLexmark(fila);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.origen).toBe("WO");
    expect(r.ignoradas).toBe(0);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]).toMatchObject({
      origen: "WO",
      numero_orden: "12345678",
      numero_visita: 1,
      cliente: "AUTOZONE MEXICO",
      contacto: "Juan Perez",
      tel_fijo: null,
      tel_movil: "555-1234",
      direccion: "Street 1 Value, Street 2 Value, Tapachula, Building1",
      localidad: "Tapachula",
      estado: "Chiapas",
      modelo: "LaserPrinter",
      serie: "SN123",
      falla: "Printer jam",
      estatus: "Nuevo",
    });
  });

  it("una fila SR nace 'Pendiente por partes' y toma la falla de la columna 14", () => {
    const fila = filaCruda({
      0: "1-123456789012",
      14: "Toner bajo", // Customer Reported Problem Code -> falla (SR)
      15: "BBVA Bancomer",
    });

    const r = parsearReporteLexmark(fila);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.origen).toBe("SR");
    expect(r.filas[0].estatus).toBe("Pendiente por partes");
    expect(r.filas[0].falla).toBe("Toner bajo");
  });

  it("si Product viene vacío, cae a Machine Type Model (MTM) como modelo", () => {
    const fila = filaCruda({
      0: "12345678",
      8: "MTM-9000",
      15: "Cliente",
    });
    const r = parsearReporteLexmark(fila);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas[0].modelo).toBe("MTM-9000");
  });

  it("tolera una fila de encabezados pegada junto con los datos", () => {
    const encabezado = "Work Order Number\tWork Order Type";
    const dato = filaCruda({ 0: "12345678", 15: "Cliente" });
    const r = parsearReporteLexmark(`${encabezado}\n${dato}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas).toHaveLength(1);
  });

  it("descarta filas duplicadas (mismo número de orden) dentro del mismo pegado", () => {
    const dato = filaCruda({ 0: "12345678", 15: "Cliente" });
    const r = parsearReporteLexmark(`${dato}\n${dato}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas).toHaveLength(1);
  });

  it("cuenta como ignorada una fila cuya primera celda no es un número de orden reconocible", () => {
    const buena = filaCruda({ 0: "12345678", 15: "Cliente" });
    const mala = filaCruda({ 0: "no-es-un-numero", 15: "Otro" });
    const r = parsearReporteLexmark(`${buena}\n${mala}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas).toHaveLength(1);
    expect(r.ignoradas).toBe(1);
  });

  it("origen 'mixto' cuando el pegado trae WO y SR juntos", () => {
    const wo = filaCruda({ 0: "12345678", 15: "Cliente A" });
    const sr = filaCruda({ 0: "1-123456789012", 15: "Cliente B" });
    const r = parsearReporteLexmark(`${wo}\n${sr}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.origen).toBe("mixto");
  });
});
