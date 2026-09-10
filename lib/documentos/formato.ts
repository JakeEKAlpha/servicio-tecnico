/**
 * Helpers de formato de fecha/hora para la generación de documentos.
 * Portados de `_fmtFechaDoc`, `_fmtHoraDoc` y `_yyyyMmDesdeFechaTexto`
 * de 03_GeneracionDocs.gs.
 */

/** `fecha_eta` (date de Postgres, "YYYY-MM-DD") -> "DD/MM/YYYY". */
export function fmtFechaDoc(val: string | null | undefined): string {
  if (!val) return "";
  const s = String(val).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s; // ya viene dd/MM/yyyy
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
}

/**
 * `hora_eta` es texto libre (soporta rangos "10:00 a. m. - 11:00 a. m.").
 * El original, para un string, lo devuelve recortado tal cual.
 */
export function fmtHoraDoc(val: string | null | undefined): string {
  if (!val) return "";
  return String(val).trim();
}

/** Fecha ("YYYY-MM-DD" o "DD/MM/YYYY") -> "YYYY-MM" para la subcarpeta de mes. */
export function yyyyMmDesdeFecha(fecha: string | null | undefined): string {
  const s = String(fecha ?? "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const dmy = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  // Fallback: mes actual en horario de México.
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const y = partes.find((p) => p.type === "year")?.value ?? "1970";
  const m = partes.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}
