/**
 * Texto de ETA listo para copiar y pegar (WhatsApp / correo al cliente).
 * Réplica del formato del sistema viejo:
 *
 *   ETA
 *
 *   Ing. Gonzalo Casildo Trejo
 *   Día: Jueves
 *   Fecha: 10 de septiembre de 2026
 *   Hora aproximada: 10:00 a. m.
 */

const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Devuelve el bloque de ETA, o `null` si falta ingeniero / fecha / hora. */
export function textoEta(
  ingenieroNombre: string | null | undefined,
  fechaEta: string | null | undefined,
  horaEta: string | null | undefined,
): string | null {
  if (!ingenieroNombre || !fechaEta || !horaEta) return null;

  const m = fechaEta.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mes, d] = m;
  // Fecha local sin desfase de zona.
  const fecha = new Date(Number(y), Number(mes) - 1, Number(d));

  const dia = DIAS[fecha.getDay()];
  const fechaLarga = `${Number(d)} de ${MESES[Number(mes) - 1]} de ${y}`;

  const nombre = ingenieroNombre.trim();
  const conTitulo = /^ing\.?\s/i.test(nombre) ? nombre : `Ing. ${nombre}`;

  return [
    "ETA",
    "",
    conTitulo,
    `Día: ${dia}`,
    `Fecha: ${fechaLarga}`,
    `Hora aproximada: ${horaEta.trim()}`,
  ].join("\n");
}
