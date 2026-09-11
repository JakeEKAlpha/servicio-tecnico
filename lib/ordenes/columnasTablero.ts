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
};

export const COLUMNAS_TABLERO: ColumnaTablero[] = [
  { id: "servicio", etiqueta: "Servicio", anchoDef: 84 },
  { id: "numero", etiqueta: "Número", anchoDef: 120, fijo: true },
  { id: "visitas", etiqueta: "Vis.", anchoDef: 56, colapsaConPanel: true },
  { id: "cliente", etiqueta: "Cliente", anchoDef: 220, fijo: true },
  { id: "localidad", etiqueta: "Localidad", anchoDef: 140, colapsaConPanel: true },
  { id: "estado", etiqueta: "Estado", anchoDef: 100, colapsaConPanel: true },
  { id: "sucursal", etiqueta: "Sucursal", anchoDef: 130, colapsaConPanel: true },
  { id: "ingeniero", etiqueta: "Ingeniero", anchoDef: 160 },
  { id: "fecha_eta", etiqueta: "Fecha ETA", anchoDef: 130 },
  { id: "hora_eta", etiqueta: "Hora ETA", anchoDef: 90, colapsaConPanel: true },
  { id: "estatus", etiqueta: "Estatus / acciones", anchoDef: 210, fijo: true },
];

export const IDS_COLUMNAS_TABLERO = COLUMNAS_TABLERO.map((c) => c.id);

export const ANCHO_MIN = 44;
export const ANCHO_MAX = 480;

export function columnaTablero(id: string): ColumnaTablero | undefined {
  return COLUMNAS_TABLERO.find((c) => c.id === id);
}

/** IDs que el usuario puede ocultar (todo lo que no es `fijo`). */
export const IDS_OCULTABLES = COLUMNAS_TABLERO.filter((c) => !c.fijo).map((c) => c.id);
