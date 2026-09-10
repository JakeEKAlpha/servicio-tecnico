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
