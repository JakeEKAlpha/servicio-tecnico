export const ESTADOS_PIEZA = [
  "recomendada",
  "en_espera",
  "recibida",
  "apartada",
  "usada",
  "cancelada",
] as const;

export type EstadoPieza = (typeof ESTADOS_PIEZA)[number];

export type PiezaOrden = {
  id: string;
  orden_id: string;
  numero_parte: string;
  descripcion: string | null;
  estado: EstadoPieza;
  cantidad: number;
  es_reposicion: boolean;
  validada_almacen: boolean;
  creada_en: string;
  recibida_en: string | null;
  apartada_en: string | null;
  usada_en: string | null;
};

export const ETIQUETA_ESTADO_PIEZA: Record<EstadoPieza, string> = {
  recomendada: "Recomendada",
  en_espera: "En espera",
  recibida: "Recibida",
  apartada: "Apartada",
  usada: "Usada",
  cancelada: "Cancelada",
};

/** Patrón de número de parte Lexmark: 2 dígitos + X + 4 dígitos (ej. 40X7743). */
export const RE_NUM_PARTE = /\b\d{2}X\d{4}\b/g;

/** Extrae números de parte candidatos de un texto (resumen de la WO, etc.). */
export function detectarNumerosParte(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const m = String(texto).toUpperCase().match(RE_NUM_PARTE) ?? [];
  return [...new Set(m)];
}
