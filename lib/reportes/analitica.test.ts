import { describe, expect, it } from "vitest";
import {
  calcularKpis,
  estadoSla,
  porEstatus,
  porIngeniero,
  porTipoServicio,
  tendenciaSemanal,
  vencidasAbiertas,
  type OrdenAnalitica,
} from "./analitica";

const ahora = new Date("2026-09-11T12:00:00");

function orden(o: Partial<OrdenAnalitica>): OrdenAnalitica {
  return {
    id: o.id ?? "id-" + Math.random(),
    numero_orden: o.numero_orden ?? "1",
    origen: o.origen ?? "WO",
    estatus: o.estatus ?? "Nuevo",
    cliente: o.cliente ?? "Cliente X",
    creado_en: o.creado_en ?? "2026-09-01T00:00:00Z",
    concluido_en: o.concluido_en ?? null,
    fecha_eta: o.fecha_eta ?? null,
    sucursal_nombre: o.sucursal_nombre ?? "Mérida",
    ingeniero_nombre: o.ingeniero_nombre ?? "Juan",
    marca_nombre: o.marca_nombre ?? "Lexmark",
    tipo_contrato: o.tipo_contrato ?? null,
    datos_especificos: o.datos_especificos ?? {},
  };
}

describe("estadoSla", () => {
  it("no_aplica cuando no es Lexmark o falta el dato de compromiso", () => {
    expect(estadoSla(orden({ origen: "MANUAL" }), ahora)).toBe("no_aplica");
    expect(estadoSla(orden({ origen: "WO", datos_especificos: {} }), ahora)).toBe("no_aplica");
  });

  it("vencida: WO abierta cuyo Customer Committed Completion Date ya pasó", () => {
    const o = orden({
      origen: "WO",
      estatus: "Asignado",
      datos_especificos: { "Customer Committed Completion Date": "9/1/2026 6:00 PM" },
    });
    expect(estadoSla(o, ahora)).toBe("vencida");
  });

  it("en_riesgo: WO abierta dentro del plazo", () => {
    const o = orden({
      origen: "WO",
      estatus: "Asignado",
      datos_especificos: { "Customer Committed Completion Date": "9/20/2026 6:00 PM" },
    });
    expect(estadoSla(o, ahora)).toBe("en_riesgo");
  });

  it("cumplida: SR concluida antes de creado_en + 22 días", () => {
    const o = orden({
      origen: "SR",
      estatus: "Concluido",
      creado_en: "2026-09-01T00:00:00Z",
      concluido_en: "2026-09-10T00:00:00Z", // 9 días, dentro de 22
    });
    expect(estadoSla(o, ahora)).toBe("cumplida");
  });

  it("incumplida: SR concluida después de creado_en + 22 días", () => {
    const o = orden({
      origen: "SR",
      estatus: "Concluido",
      creado_en: "2026-08-01T00:00:00Z",
      concluido_en: "2026-09-10T00:00:00Z", // 40 días, fuera de 22
    });
    expect(estadoSla(o, ahora)).toBe("incumplida");
  });
});

describe("calcularKpis", () => {
  it("cuenta activas/concluidas/canceladas y el cumplimiento de SLA solo sobre lo evaluable", () => {
    const ordenes = [
      orden({ estatus: "Asignado" }), // activa, no_aplica (sin dato)
      orden({ estatus: "Concluido" }), // concluida, no_aplica
      orden({ estatus: "Cancelado" }),
      orden({
        origen: "SR",
        estatus: "Concluido",
        creado_en: "2026-09-01T00:00:00Z",
        concluido_en: "2026-09-05T00:00:00Z",
      }), // cumplida
      orden({
        origen: "SR",
        estatus: "Concluido",
        creado_en: "2026-08-01T00:00:00Z",
        concluido_en: "2026-09-10T00:00:00Z",
      }), // incumplida
      orden({
        origen: "WO",
        estatus: "Asignado",
        datos_especificos: { "Customer Committed Completion Date": "9/1/2026 6:00 PM" },
      }), // vencida abierta
    ];
    const k = calcularKpis(ordenes, ahora);
    expect(k.total).toBe(6);
    expect(k.activas).toBe(2); // Asignado + WO vencida (también Asignado)
    expect(k.concluidas).toBe(3); // Concluido simple + las 2 SR concluidas
    expect(k.canceladas).toBe(1);
    expect(k.conSlaEvaluable).toBe(2);
    expect(k.cumplidasATiempo).toBe(1);
    expect(k.incumplidas).toBe(1);
    expect(k.tasaCumplimientoSla).toBe(50);
    expect(k.vencidasAbiertas).toBe(1);
  });

  it("tasaCumplimientoSla es null cuando no hay ninguna orden evaluable todavía", () => {
    const k = calcularKpis([orden({ origen: "MANUAL" })], ahora);
    expect(k.tasaCumplimientoSla).toBeNull();
  });

  it("diasPromedioConclusion promedia solo las que tienen ambas fechas válidas", () => {
    const ordenes = [
      orden({ creado_en: "2026-09-01T00:00:00Z", concluido_en: "2026-09-03T00:00:00Z" }), // 2 días
      orden({ creado_en: "2026-09-01T00:00:00Z", concluido_en: "2026-09-05T00:00:00Z" }), // 4 días
      orden({ concluido_en: null }), // no cuenta
    ];
    expect(calcularKpis(ordenes, ahora).diasPromedioConclusion).toBe(3);
  });
});

describe("porEstatus", () => {
  it("agrupa y ordena descendente por conteo", () => {
    const ordenes = [
      orden({ estatus: "Asignado" }),
      orden({ estatus: "Asignado" }),
      orden({ estatus: "Nuevo" }),
    ];
    expect(porEstatus(ordenes)).toEqual([
      { estatus: "Asignado", n: 2 },
      { estatus: "Nuevo", n: 1 },
    ]);
  });
});

describe("porTipoServicio", () => {
  it("usa la misma categoría que prioridadServicio (WO/SR/Xerox/contrato)", () => {
    const ordenes = [
      orden({ origen: "WO", marca_nombre: "Lexmark" }),
      orden({ origen: "WO", marca_nombre: "Lexmark" }),
      orden({ origen: "SR", marca_nombre: "Lexmark" }),
      orden({ origen: "MANUAL", marca_nombre: "Xerox" }),
    ];
    const r = porTipoServicio(ordenes);
    expect(r).toContainEqual({ etiqueta: "WO Lexmark", n: 2 });
    expect(r).toContainEqual({ etiqueta: "SR Lexmark", n: 1 });
    expect(r).toContainEqual({ etiqueta: "Visita Xerox", n: 1 });
  });
});

describe("porIngeniero", () => {
  it("agrupa por ingeniero y calcula tasa de cumplimiento solo sobre lo evaluable", () => {
    const ordenes = [
      orden({
        ingeniero_nombre: "Ana",
        origen: "SR",
        estatus: "Concluido",
        creado_en: "2026-09-01T00:00:00Z",
        concluido_en: "2026-09-05T00:00:00Z",
      }),
      orden({ ingeniero_nombre: "Ana", origen: "MANUAL" }), // no evaluable
      { ...orden({}), ingeniero_nombre: null },
    ];
    const r = porIngeniero(ordenes, ahora);
    const ana = r.find((f) => f.ingeniero === "Ana")!;
    expect(ana.total).toBe(2);
    expect(ana.cumplidas).toBe(1);
    expect(ana.tasaCumplimiento).toBe(100);
    expect(r.find((f) => f.ingeniero === "Sin asignar")).toBeTruthy();
  });
});

describe("tendenciaSemanal", () => {
  it("devuelve exactamente `semanas` puntos y cuenta creadas/concluidas en su semana", () => {
    const puntos = tendenciaSemanal(
      [orden({ creado_en: ahora.toISOString(), concluido_en: ahora.toISOString() })],
      ahora,
      4,
    );
    expect(puntos).toHaveLength(4);
    const ultima = puntos[puntos.length - 1];
    expect(ultima.proyectadas).toBe(1);
    expect(ultima.completadas).toBe(1);
    // Las semanas anteriores no tienen nada.
    expect(puntos[0].proyectadas).toBe(0);
  });
});

describe("vencidasAbiertas", () => {
  it("solo incluye abiertas vencidas, ordenadas por más vencida primero", () => {
    const pocoVencida = orden({
      id: "poco",
      origen: "WO",
      estatus: "Asignado",
      datos_especificos: { "Customer Committed Completion Date": "9/10/2026 6:00 PM" },
    });
    const muyVencida = orden({
      id: "muy",
      origen: "WO",
      estatus: "Asignado",
      datos_especificos: { "Customer Committed Completion Date": "8/1/2026 6:00 PM" },
    });
    const concluida = orden({
      id: "concluida",
      origen: "WO",
      estatus: "Concluido",
      concluido_en: "2026-09-11T00:00:00Z",
      datos_especificos: { "Customer Committed Completion Date": "8/1/2026 6:00 PM" },
    });
    const r = vencidasAbiertas([pocoVencida, muyVencida, concluida], ahora);
    expect(r.map((o) => o.id)).toEqual(["muy", "poco"]);
  });
});
