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
