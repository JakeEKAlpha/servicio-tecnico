/**
 * Tipos de evidencia de campo (tabla `evidencias.tipo`, CHECK en BD) y su
 * presentación en la app del ingeniero.
 */
export const TIPOS_EVIDENCIA = [
  { tipo: "llegada", label: "Llegada en sitio", multiple: false, foto: true },
  { tipo: "antes", label: "Antes (falla / estado inicial)", multiple: true, foto: true },
  { tipo: "durante", label: "Durante (proceso)", multiple: true, foto: true },
  { tipo: "despues", label: "Final (equipo listo y pruebas)", multiple: true, foto: true },
  { tipo: "piezas", label: "Piezas / refacciones", multiple: true, foto: true },
  { tipo: "reporte_equipo", label: "Reportes exportados del equipo", multiple: true, foto: false },
  { tipo: "os_firmada", label: "Orden de servicio firmada", multiple: false, foto: true },
] as const;

export type TipoEvidencia = (typeof TIPOS_EVIDENCIA)[number]["tipo"];

export const TIPOS_EVIDENCIA_VALIDOS: readonly string[] = TIPOS_EVIDENCIA.map(
  (t) => t.tipo,
);

export type Evidencia = {
  id: string;
  orden_id: string;
  tipo: TipoEvidencia;
  url: string;
  nota: string | null;
  subida_por: string | null;
  creada_en: string;
};

/** Ruta dentro del bucket `evidencias`: <orden_id>/<tipo>-<epoch>-<rand>.<ext> */
export function rutaEvidencia(ordenId: string, tipo: string, nombre: string): string {
  const ext = (nombre.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ordenId}/${tipo}-${Date.now()}-${rand}.${ext}`;
}
