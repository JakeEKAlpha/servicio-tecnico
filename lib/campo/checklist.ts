/**
 * Checklist de verificación técnica Lexmark — 13 puntos.
 * Réplica exacta del formulario del script `lexmark_service_by_alpha_digital`.
 * Se guarda en `ordenes.checklist` (jsonb) como `{ [key]: boolean }`.
 */
export const CHECKLIST_CAMPO = [
  { key: "printQuality", label: "Impresión páginas de calidad" },
  { key: "duplexPrint", label: "Impresión doble cara" },
  { key: "adfScan", label: "Escaneo por ADF" },
  { key: "flatbedScan", label: "Escaneo por cama plana" },
  { key: "copyTests", label: "Pruebas de copia" },
  { key: "otherTests", label: "Otras pruebas" },
  { key: "maintenanceCleaning", label: "Mantenimiento / limpieza" },
  { key: "paperPath", label: "Trayectoria de papel" },
  { key: "paperRollers", label: "Rodillos de papel" },
  { key: "laserPrinthead", label: "Láser · printhead" },
  { key: "externalCleaning", label: "Limpieza externa" },
  { key: "scannerCleaning", label: "Limpieza del escáner" },
  { key: "firmwareUpdate", label: "Actualización de firmware" },
] as const;

export type ChecklistCampo = Record<string, boolean>;

export const CLAVES_CHECKLIST: readonly string[] = CHECKLIST_CAMPO.map(
  (c) => c.key,
);

/** Normaliza un jsonb arbitrario al set de claves conocidas. */
export function normalizarChecklist(v: unknown): ChecklistCampo {
  const src = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: ChecklistCampo = {};
  for (const k of CLAVES_CHECKLIST) out[k] = src[k] === true;
  return out;
}

export function checklistCompleto(v: unknown): boolean {
  const c = normalizarChecklist(v);
  return CLAVES_CHECKLIST.every((k) => c[k]);
}

export function checklistHechos(v: unknown): number {
  const c = normalizarChecklist(v);
  return CLAVES_CHECKLIST.filter((k) => c[k]).length;
}
