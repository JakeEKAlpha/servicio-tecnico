/**
 * Constantes de estatus de órdenes — equivale a lo que en el sistema viejo
 * vivía en `LexmarkCore.gs`.
 *
 * Fuente de verdad del enum: tipo `estatus_orden` en Supabase.
 */

/** Todos los valores del enum `estatus_orden` en la base de datos. */
export const ESTATUS_ORDEN = [
  "Nuevo",
  "Pendiente",
  "Asignado",
  "Reagendado",
  "Pendiente por partes",
  "Lista para realizar", // sistema: SR/pieza-antes-de-visita, piezas ya llegaron
  "Listo para continuar", // sistema: WO reactiva, piezas de la 2ª visita llegaron
  "Concluido",
  "Cancelado",
] as const;

export type EstatusOrden = (typeof ESTATUS_ORDEN)[number];

/**
 * Estatus que un coordinador/ingeniero puede poner a mano.
 * "Lista para realizar" y "Listo para continuar" NO están: los pone el
 * sistema (trigger de arribo de piezas). "Cancelado" solo desde gerencia.
 */
export const ESTATUS_MANUALES = [
  "Nuevo",
  "Pendiente",
  "Asignado",
  "Reagendado",
  "Pendiente por partes",
  "Concluido",
] as const;

/**
 * Prioridad de orden visual en el Tablero (1 = arriba … 5 = abajo).
 * Base: `LexmarkCore.PRIORIDAD_ESTATUS`; los 2 estatus nuevos son accionables
 * (hay que agendar) → prioridad 1.
 */
export const PRIORIDAD_ESTATUS: Record<string, number> = {
  "Lista para realizar": 1,
  "Listo para continuar": 1,
  Asignado: 1,
  Nuevo: 2,
  Pendiente: 2,
  Reagendado: 3,
  "Pendiente por partes": 4,
  Concluido: 5,
};

/** Prioridad numérica de un estatus. Desconocido (incl. "Cancelado") → 9. */
export function prioridadDe(estatus: string | null | undefined): number {
  const key = String(estatus ?? "").trim();
  return PRIORIDAD_ESTATUS[key] ?? 9;
}

/**
 * Prioridad de urgencia por TIPO de servicio (decisión del usuario,
 * 2026-09-11) — dentro de un mismo estatus, quién urge más asignar:
 *   1) WO Lexmark  2) Visita Xerox  3) SR Lexmark
 *   4) Renta Alpha  5) Garantía/Póliza Alpha  6) TyM
 *   7) todo lo demás (instalación/garantía de consumible de ejecutivo,
 *      o una orden de Alpha sin contrato vinculado todavía).
 *
 * Limitación conocida: solo puede ver el tipo de contrato si
 * `ordenes.contrato_id` está lleno — hoy nada lo escribe todavía (el
 * emparejamiento cliente↔orden sigue siendo por nombre difuso), así que la
 * mayoría de las órdenes de Alpha caen en el nivel 7 hasta que se conecte
 * un selector de contrato en la captura de la orden.
 */
export function prioridadServicio(
  origen: string | null | undefined,
  marca: string | null | undefined,
  tipoContrato: string | null | undefined,
): number {
  const m = String(marca ?? "").toLowerCase();
  if (m.includes("xerox")) return 2;

  const o = String(origen ?? "").toUpperCase();
  if (o === "WO") return 1;
  if (o === "SR") return 3;

  switch (tipoContrato) {
    case "renta":
      return 4;
    case "garantia":
    case "poliza":
      return 5;
    case "tym":
      return 6;
    default:
      return 7;
  }
}

/**
 * Etiqueta legible de la misma categoría que usa `prioridadServicio` — para
 * la pantalla de análisis (agrupar por tipo de servicio). Mantener el orden
 * de condiciones sincronizado con `prioridadServicio` si cambia la regla.
 */
export function etiquetaServicio(
  origen: string | null | undefined,
  marca: string | null | undefined,
  tipoContrato: string | null | undefined,
): string {
  const m = String(marca ?? "").toLowerCase();
  if (m.includes("xerox")) return "Visita Xerox";

  const o = String(origen ?? "").toUpperCase();
  if (o === "WO") return "WO Lexmark";
  if (o === "SR") return "SR Lexmark";

  switch (tipoContrato) {
    case "renta":
      return "Renta";
    case "garantia":
      return "Garantía";
    case "poliza":
      return "Póliza";
    case "tym":
      return "TyM";
    default:
      return "Otro";
  }
}
