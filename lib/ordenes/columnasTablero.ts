/**
 * Catálogo de columnas de la vista "Tabla" del Tablero — fuente única para:
 *   - qué columnas existen, su etiqueta y ancho por defecto (usado por
 *     `TablaOrdenes.tsx` y por el selector en Configuración).
 *   - la validación del lado del servidor de las preferencias guardadas
 *     (`app/api/preferencias/route.ts`).
 *
 * Sin JSX ni APIs de navegador: lo importan tanto componentes de cliente
 * como el route handler (servidor).
 */

export type ColumnaTableroId =
  | "servicio"
  | "numero"
  | "visitas"
  | "cliente"
  | "localidad"
  | "estado"
  | "sucursal"
  | "ingeniero"
  | "fecha_eta"
  | "hora_eta"
  | "estatus";

export type ColumnaTablero = {
  id: ColumnaTableroId;
  etiqueta: string;
  /** Ancho por defecto, en px. */
  anchoDef: number;
  /** No se puede ocultar (identifica la fila o trae las acciones). */
  fijo?: boolean;
  /** Se oculta automáticamente cuando el panel de detalle está abierto,
   *  sin importar la preferencia del usuario — es espacio, no elección. */
  colapsaConPanel?: boolean;
  /** Ancho mínimo propio, si `ANCHO_MIN` (44px) es insuficiente — ej.
   *  "Estatus / acciones" trae un `&lt;select&gt;` y botones reales, no solo
   *  texto: a 44px quedarían tapados/inutilizables, no solo recortados
   *  visualmente como pasaría con una columna de puro texto. Hallazgo de
   *  auditoría 2026-09-11. */
  anchoMin?: number;
};

// Anchos por defecto angostados (auditoría 2026-09-11): con los anchos
// originales, la suma de las 11 columnas (1440px) siempre forzaba scroll
// horizontal en un escritorio típico (1024-1280px), incluso sin ocultar
// ninguna. Se compensa con una tipografía más compacta en la tabla
// (`TablaOrdenes.tsx`, solo aplica a esta vista de escritorio). Nueva suma:
// ~1000px — cabe holgado en 1280px y casi sin scroll en 1024px.
export const COLUMNAS_TABLERO: ColumnaTablero[] = [
  { id: "servicio", etiqueta: "Servicio", anchoDef: 72 },
  { id: "numero", etiqueta: "Número", anchoDef: 100, fijo: true },
  { id: "visitas", etiqueta: "Vis.", anchoDef: 44, colapsaConPanel: true },
  { id: "cliente", etiqueta: "Cliente", anchoDef: 160, fijo: true },
  { id: "localidad", etiqueta: "Localidad", anchoDef: 100, colapsaConPanel: true },
  { id: "estado", etiqueta: "Estado", anchoDef: 76, colapsaConPanel: true },
  { id: "sucursal", etiqueta: "Sucursal", anchoDef: 92, colapsaConPanel: true },
  { id: "ingeniero", etiqueta: "Ingeniero", anchoDef: 112 },
  { id: "fecha_eta", etiqueta: "Fecha ETA", anchoDef: 104 },
  { id: "hora_eta", etiqueta: "Hora ETA", anchoDef: 60, colapsaConPanel: true },
  {
    id: "estatus",
    etiqueta: "Estatus / acciones",
    anchoDef: 172,
    fijo: true,
    anchoMin: 160,
  },
];

export const IDS_COLUMNAS_TABLERO = COLUMNAS_TABLERO.map((c) => c.id);

export const ANCHO_MIN = 44;
export const ANCHO_MAX = 480;

export function columnaTablero(id: string): ColumnaTablero | undefined {
  return COLUMNAS_TABLERO.find((c) => c.id === id);
}

/** Ancho mínimo real para una columna — el suyo propio si lo define, si no
 *  el genérico `ANCHO_MIN`. */
export function anchoMinDe(id: string): number {
  return columnaTablero(id)?.anchoMin ?? ANCHO_MIN;
}

/** IDs que el usuario puede ocultar (todo lo que no es `fijo`). */
export const IDS_OCULTABLES = COLUMNAS_TABLERO.filter((c) => !c.fijo).map((c) => c.id);
