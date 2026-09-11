import { describe, expect, it } from "vitest";
import { calcularFechaLimiteSla, horasParaVencerSla, parsearFechaLexmark } from "./sla";

describe("parsearFechaLexmark", () => {
  it("parsea el formato de WO (M/D/YYYY h:mm AM/PM)", () => {
    const d = parsearFechaLexmark("8/6/2026 10:32 AM");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(7); // agosto (0-indexado)
    expect(d!.getDate()).toBe(6);
    expect(d!.getHours()).toBe(10);
    expect(d!.getMinutes()).toBe(32);
  });

  it("mediodía y medianoche en formato 12h (casos clásicos de off-by-12)", () => {
    expect(parsearFechaLexmark("9/18/2026 12:00 PM")!.getHours()).toBe(12);
    expect(parsearFechaLexmark("9/18/2026 12:00 AM")!.getHours()).toBe(0);
  });

  it("parsea el formato de SR (MM/DD/YYYY HH:mm:ss, 24h)", () => {
    const d = parsearFechaLexmark("07/28/2026 10:48:25");
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(6); // julio
    expect(d!.getDate()).toBe(28);
    expect(d!.getHours()).toBe(10);
    expect(d!.getSeconds()).toBe(25);
  });

  it("una hora tarde (16:30) en formato 24h no se confunde con AM/PM", () => {
    const d = parsearFechaLexmark("07/31/2026 16:30:00");
    expect(d!.getHours()).toBe(16);
  });

  it("null, vacío o texto irreconocible dan null", () => {
    expect(parsearFechaLexmark(null)).toBeNull();
    expect(parsearFechaLexmark(undefined)).toBeNull();
    expect(parsearFechaLexmark("")).toBeNull();
    expect(parsearFechaLexmark("no es una fecha")).toBeNull();
  });
});

describe("horasParaVencerSla", () => {
  const ahora = new Date("2026-09-11T12:00:00");

  it("WO: usa 'Customer Committed Completion Date', horas positivas si falta tiempo", () => {
    const horas = horasParaVencerSla(
      "WO",
      { "Customer Committed Completion Date": "9/18/2026 6:00 PM" },
      null,
      ahora,
    );
    expect(horas).not.toBeNull();
    expect(horas).toBeGreaterThan(0);
  });

  it("WO: negativo si la fecha comprometida ya pasó", () => {
    const horas = horasParaVencerSla(
      "WO",
      { "Customer Committed Completion Date": "9/1/2026 6:00 PM" },
      null,
      ahora,
    );
    expect(horas).toBeLessThan(0);
  });

  it("WO: null si falta el dato — no debe romper el orden ni la app", () => {
    expect(horasParaVencerSla("WO", {}, null, ahora)).toBeNull();
    expect(horasParaVencerSla("WO", null, null, ahora)).toBeNull();
  });

  it("SR: ignora la fecha del import, usa creado_en + 22 días — dentro del plazo", () => {
    // Creado hace 5 días — quedan 17 de los 22.
    const creado = new Date(ahora.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const horas = horasParaVencerSla(
      "SR",
      { "Customer Committed Response Date": "algo que se ignora" },
      creado,
      ahora,
    );
    expect(horas).not.toBeNull();
    expect(horas!).toBeCloseTo(17 * 24, 0);
  });

  it("SR: pasado el día 22, sigue escalando en negativo — nunca se topa", () => {
    // Creado hace 30 días — 8 días vencido de los 22.
    const creado30 = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const horas30 = horasParaVencerSla("SR", {}, creado30, ahora);

    // Creado hace 50 días — más vencido todavía, debe ser más urgente (más negativo).
    const creado50 = new Date(ahora.getTime() - 50 * 24 * 60 * 60 * 1000).toISOString();
    const horas50 = horasParaVencerSla("SR", {}, creado50, ahora);

    expect(horas30).toBeLessThan(0);
    expect(horas50).toBeLessThan(horas30!);
  });

  it("SR: null si falta creado_en o es inválido", () => {
    expect(horasParaVencerSla("SR", {}, null, ahora)).toBeNull();
    expect(horasParaVencerSla("SR", {}, "fecha-invalida", ahora)).toBeNull();
  });

  it("otros orígenes (MANUAL, etc.) siempre dan null — no tienen SLA de Lexmark", () => {
    expect(
      horasParaVencerSla("MANUAL", { "Customer Committed Completion Date": "1/1/2027 1:00 AM" }, null, ahora),
    ).toBeNull();
  });
});

describe("calcularFechaLimiteSla", () => {
  it("WO: la fecha límite absoluta es la 'Customer Committed Completion Date' parseada", () => {
    const limite = calcularFechaLimiteSla(
      "WO",
      { "Customer Committed Completion Date": "9/18/2026 6:00 PM" },
      null,
    );
    expect(limite).not.toBeNull();
    expect(limite!.getDate()).toBe(18);
    expect(limite!.getHours()).toBe(18);
  });

  it("SR: la fecha límite absoluta es creado_en + 22 días — usada por la pantalla de análisis para saber si una orden concluyó a tiempo", () => {
    const creado = new Date("2026-09-01T00:00:00");
    const limite = calcularFechaLimiteSla("SR", {}, creado.toISOString());
    expect(limite).not.toBeNull();
    expect(limite!.getTime() - creado.getTime()).toBe(22 * 24 * 60 * 60 * 1000);
  });

  it("es la misma fuente que usa horasParaVencerSla (no una regla distinta)", () => {
    const ahora = new Date("2026-09-11T12:00:00");
    const datos = { "Customer Committed Completion Date": "9/18/2026 6:00 PM" };
    const limite = calcularFechaLimiteSla("WO", datos, null)!;
    const horas = horasParaVencerSla("WO", datos, null, ahora)!;
    expect((limite.getTime() - ahora.getTime()) / (1000 * 60 * 60)).toBeCloseTo(horas, 6);
  });
});
