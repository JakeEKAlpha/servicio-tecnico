/**
 * Análisis de servicios (gerencia) — funciones puras de agregación.
 *
 * Adaptado del dashboard ejecutivo de referencia que compartió el usuario
 * (lee un Google Sheet con columnas llenadas a mano: "VALIDEZ DEL SLA",
 * "JUSTIFICACIÓN"). Por instrucción explícita del usuario ("no inventes
 * campos, no crees, paréalos, respeta los filtros, usa la lógica") esta
 * versión NO inventa esas dos columnas ni lee el Sheet: empareja los mismos
 * conceptos (volumen, distribución, cumplimiento de SLA) con datos que la
 * app ya captura de verdad —`ordenes` + `ordenes_historial`— y reutiliza la
 * MISMA regla de SLA que ya ordena la cola del Tablero
 * (`calcularFechaLimiteSla`, ver `lib/ordenes/sla.ts`).
 *
 * Limitación conocida y aceptada (documentada también en ARQUITECTURA.md):
 * el cumplimiento de SLA aquí es mecánico. No captura los matices que
 * Lexmark a veces sí anota en el reporte crudo (ej. una razón de atraso
 * atribuible al cliente) porque ese dato no forma parte de las 28 columnas
 * que hoy se importan (`lib/importar/lexmark.ts`) — no se inventa.
 */

import { etiquetaServicio } from "@/lib/ordenes/estatus";
import { calcularFechaLimiteSla } from "@/lib/ordenes/sla";

export type OrdenAnalitica = {
  id: string;
  numero_orden: string;
  origen: string | null;
  estatus: string | null;
  cliente: string | null;
  creado_en: string;
  concluido_en: string | null;
  fecha_eta: string | null;
  sucursal_nombre: string | null;
  ingeniero_nombre: string | null;
  marca_nombre: string | null;
  tipo_contrato: string | null;
  datos_especificos: Record<string, string> | null;
};

/** Estado de SLA de una orden, calculado con la misma regla del Tablero. */
export type EstadoSla =
  | "no_aplica" // no es Lexmark, o falta el dato de origen
  | "cumplida" // concluyó en o antes del límite
  | "incumplida" // concluyó después del límite
  | "en_riesgo" // abierta, dentro del plazo
  | "vencida"; // abierta, ya pasó el límite

export function estadoSla(o: OrdenAnalitica, ahora: Date): EstadoSla {
  // Cancelada: no hay veredicto de SLA que dar — no cuenta como incumplimiento
  // ni como "vencida abierta" (no está abierta, está cancelada).
  if (o.estatus === "Cancelado") return "no_aplica";

  const limite = calcularFechaLimiteSla(o.origen, o.datos_especificos, o.creado_en);
  if (!limite) return "no_aplica";

  if (o.concluido_en) {
    const cierre = new Date(o.concluido_en);
    if (Number.isNaN(cierre.getTime())) return "no_aplica";
    return cierre.getTime() <= limite.getTime() ? "cumplida" : "incumplida";
  }

  return ahora.getTime() > limite.getTime() ? "vencida" : "en_riesgo";
}

export type KpisReporte = {
  total: number;
  activas: number;
  concluidas: number;
  canceladas: number;
  /** Con SLA de Lexmark aplicable (WO o SR) y ya cerrado con veredicto. */
  conSlaEvaluable: number;
  cumplidasATiempo: number;
  incumplidas: number;
  /** % sobre `conSlaEvaluable`; `null` si no hay ninguna evaluable todavía. */
  tasaCumplimientoSla: number | null;
  /** Abiertas cuyo límite de SLA ya pasó — requieren atención ya. */
  vencidasAbiertas: number;
  /** Días promedio entre creación y cierre, sobre concluidas con ambas fechas. */
  diasPromedioConclusion: number | null;
};

export function calcularKpis(ordenes: OrdenAnalitica[], ahora: Date): KpisReporte {
  let activas = 0;
  let concluidas = 0;
  let canceladas = 0;
  let cumplidasATiempo = 0;
  let incumplidas = 0;
  let vencidasAbiertas = 0;
  let sumaDias = 0;
  let conDuracion = 0;

  for (const o of ordenes) {
    if (o.estatus === "Cancelado") canceladas++;
    else if (o.estatus === "Concluido") concluidas++;
    else activas++;

    const estado = estadoSla(o, ahora);
    if (estado === "cumplida") cumplidasATiempo++;
    else if (estado === "incumplida") incumplidas++;
    else if (estado === "vencida") vencidasAbiertas++;

    if (o.concluido_en) {
      const creado = new Date(o.creado_en).getTime();
      const cierre = new Date(o.concluido_en).getTime();
      if (!Number.isNaN(creado) && !Number.isNaN(cierre) && cierre >= creado) {
        sumaDias += (cierre - creado) / (1000 * 60 * 60 * 24);
        conDuracion++;
      }
    }
  }

  const conSlaEvaluable = cumplidasATiempo + incumplidas;

  return {
    total: ordenes.length,
    activas,
    concluidas,
    canceladas,
    conSlaEvaluable,
    cumplidasATiempo,
    incumplidas,
    tasaCumplimientoSla:
      conSlaEvaluable > 0 ? Math.round((cumplidasATiempo / conSlaEvaluable) * 100) : null,
    vencidasAbiertas,
    diasPromedioConclusion:
      conDuracion > 0 ? Math.round((sumaDias / conDuracion) * 10) / 10 : null,
  };
}

export type ConteoEtiqueta = { etiqueta: string; n: number };

/** Distribución por estatus — misma forma que `Fase` del panel de `/inicio`,
 *  reutilizable con `GraficoFases` sin adaptar nada. */
export function porEstatus(ordenes: OrdenAnalitica[]): { estatus: string; n: number }[] {
  const conteo = new Map<string, number>();
  for (const o of ordenes) {
    const k = o.estatus ?? "Sin estatus";
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([estatus, n]) => ({ estatus, n }))
    .sort((a, b) => b.n - a.n);
}

/** Distribución por tipo de servicio (misma categoría que ordena el Tablero). */
export function porTipoServicio(ordenes: OrdenAnalitica[]): ConteoEtiqueta[] {
  const conteo = new Map<string, number>();
  for (const o of ordenes) {
    const k = etiquetaServicio(o.origen, o.marca_nombre, o.tipo_contrato);
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([etiqueta, n]) => ({ etiqueta, n }))
    .sort((a, b) => b.n - a.n);
}

export type FilaIngeniero = {
  ingeniero: string;
  total: number;
  cumplidas: number;
  incumplidas: number;
  vencidasAbiertas: number;
  tasaCumplimiento: number | null;
};

/** Cumplimiento de SLA por ingeniero — solo cuenta lo evaluable (Lexmark). */
export function porIngeniero(ordenes: OrdenAnalitica[], ahora: Date): FilaIngeniero[] {
  const filas = new Map<string, FilaIngeniero>();
  for (const o of ordenes) {
    const nombre = o.ingeniero_nombre ?? "Sin asignar";
    const fila = filas.get(nombre) ?? {
      ingeniero: nombre,
      total: 0,
      cumplidas: 0,
      incumplidas: 0,
      vencidasAbiertas: 0,
      tasaCumplimiento: null,
    };
    fila.total++;
    const estado = estadoSla(o, ahora);
    if (estado === "cumplida") fila.cumplidas++;
    else if (estado === "incumplida") fila.incumplidas++;
    else if (estado === "vencida") fila.vencidasAbiertas++;
    filas.set(nombre, fila);
  }
  return [...filas.values()]
    .map((f) => {
      const evaluable = f.cumplidas + f.incumplidas;
      return {
        ...f,
        tasaCumplimiento: evaluable > 0 ? Math.round((f.cumplidas / evaluable) * 100) : null,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export type PuntoSemana = { semana: string; creadas: number; concluidas: number };

/** Lunes (00:00) de la semana ISO que contiene `d`. */
function inicioSemana(d: Date): Date {
  const copia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dia = copia.getDay(); // 0=dom..6=sáb
  const offset = dia === 0 ? -6 : 1 - dia; // retrocede al lunes
  copia.setDate(copia.getDate() + offset);
  return copia;
}

function etiquetaSemana(inicio: Date): string {
  return `${inicio.getDate()}/${inicio.getMonth() + 1}`;
}

/** Tendencia de creadas vs. concluidas por semana, últimas `semanas` semanas
 *  (incluye la actual). Misma forma que `PuntoFlujo` del panel de `/inicio`
 *  (campo `dia` reutilizado como etiqueta de semana) para reusar `GraficoFlujo`. */
export function tendenciaSemanal(
  ordenes: OrdenAnalitica[],
  ahora: Date,
  semanas = 8,
): { dia: string; proyectadas: number; completadas: number }[] {
  const inicioActual = inicioSemana(ahora);
  const buckets: { inicio: Date; creadas: number; concluidas: number }[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const inicio = new Date(inicioActual);
    inicio.setDate(inicio.getDate() - i * 7);
    buckets.push({ inicio, creadas: 0, concluidas: 0 });
  }

  const buscar = (fecha: Date) => {
    const ini = inicioSemana(fecha).getTime();
    return buckets.find((b) => b.inicio.getTime() === ini);
  };

  for (const o of ordenes) {
    const creado = new Date(o.creado_en);
    if (!Number.isNaN(creado.getTime())) {
      const b = buscar(creado);
      if (b) b.creadas++;
    }
    if (o.concluido_en) {
      const cierre = new Date(o.concluido_en);
      if (!Number.isNaN(cierre.getTime())) {
        const b = buscar(cierre);
        if (b) b.concluidas++;
      }
    }
  }

  return buckets.map((b) => ({
    dia: etiquetaSemana(b.inicio),
    proyectadas: b.creadas,
    completadas: b.concluidas,
  }));
}

/** Órdenes abiertas cuyo SLA ya venció — para la tabla de "atención inmediata".
 *  `estadoSla` ya excluye canceladas y concluidas (nunca da "vencida" para
 *  esas), así que el filtro aquí es solo por el estado calculado. */
export function vencidasAbiertas(ordenes: OrdenAnalitica[], ahora: Date): OrdenAnalitica[] {
  return ordenes
    .filter((o) => estadoSla(o, ahora) === "vencida")
    .sort((a, b) => {
      const la = calcularFechaLimiteSla(a.origen, a.datos_especificos, a.creado_en)!;
      const lb = calcularFechaLimiteSla(b.origen, b.datos_especificos, b.creado_en)!;
      return la.getTime() - lb.getTime(); // más vencida primero
    });
}
