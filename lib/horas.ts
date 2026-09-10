/**
 * Parseo de `hora_eta` (texto libre) a horas numéricas para el Gantt.
 * Soporta: "10:00", "10:00 a. m.", "2:00 p. m.", "14:30",
 *          "10:00 a. m. - 11:00 a. m." (rango).
 */

function aNumero(txt: string): number | null {
  const s = txt.trim().toLowerCase();
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const suf = (m[3] || "").replace(/[.\s]/g, "");
  if (suf === "pm" && h < 12) h += 12;
  if (suf === "am" && h === 12) h = 0;
  if (h < 0 || h > 23) return null;
  return h + min / 60;
}

export type RangoHora = { inicio: number; fin: number | null };

/** Devuelve { inicio, fin } en horas decimales, o null si no se pudo parsear. */
export function parseHoraEta(hora: string | null | undefined): RangoHora | null {
  if (!hora) return null;
  const partes = String(hora).split(/\s*[-–]\s*/);
  const inicio = aNumero(partes[0]);
  if (inicio == null) return null;
  const fin = partes[1] ? aNumero(partes[1]) : null;
  return { inicio, fin: fin != null && fin > inicio ? fin : null };
}

/** Hora decimal -> "HH:MM". */
export function fmtHora(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
