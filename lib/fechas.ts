/** Utilidades de fecha en horario de México (America/Mexico_City). */

const TZ = "America/Mexico_City";

/** "YYYY-MM-DD" de una fecha en horario de México. */
export function isoMx(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

/** Hoy en México, "YYYY-MM-DD". */
export function hoyMx(): string {
  return isoMx(new Date());
}

/** Hora del día en México, "HH:MM:SS" (para columnas `time`). */
export function horaMx(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(fecha);
}
