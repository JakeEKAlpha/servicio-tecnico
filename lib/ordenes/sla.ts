/**
 * Urgencia de SLA — para desempatar el orden de la cola "por asignar" del
 * Tablero cuando dos órdenes ya empatan en `prioridadServicio`. Decisión del
 * usuario 2026-09-11.
 *
 * Nota de alcance: esto es solo para ORDENAR, no para reportar cumplimiento.
 * La pantalla de análisis (pendiente, ver ARQUITECTURA.md) necesitará algo
 * más rico — justificantes y motivos de retraso que a veces excusan un
 * incumplimiento (Lexmark ya los etiqueta, ej. "DELAYED DUE TO CUSTOMER").
 * Esta urgencia mecánica no captura esos matices a propósito.
 */

type DatosEspecificos = Record<string, string> | null | undefined;

/**
 * Las fechas de Lexmark vienen en 2 formatos según el tipo de reporte —
 * ambos mes/día/año (estilo del export, no día/mes):
 *  - WO: "8/6/2026 10:32 AM"     (M/D/YYYY h:mm AM/PM)
 *  - SR: "07/28/2026 10:48:25"   (MM/DD/YYYY HH:mm:ss, 24 h)
 */
export function parsearFechaLexmark(s: string | null | undefined): Date | null {
  const texto = (s ?? "").trim();
  if (!texto) return null;

  const ampm = texto.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
  );
  if (ampm) {
    const [, mes, dia, anio, horaStr, min, periodo] = ampm;
    let hora = Number(horaStr) % 12;
    if (periodo.toUpperCase() === "PM") hora += 12;
    const d = new Date(Number(anio), Number(mes) - 1, Number(dia), hora, Number(min));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const h24 = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (h24) {
    const [, mes, dia, anio, hora, min, seg] = h24;
    const d = new Date(
      Number(anio),
      Number(mes) - 1,
      Number(dia),
      Number(hora),
      Number(min),
      Number(seg),
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

const MS_POR_HORA = 1000 * 60 * 60;

/** SR: 22 días naturales desde la creación — límite fijo interno de Alpha
 *  Digital, no la fecha "Customer Committed" del import (esa no es
 *  comparable entre cuentas, decisión del usuario). Pasado ese punto la
 *  urgencia sigue escalando sin un tope especial: mientras más vencido, más
 *  arriba debe aparecer en la cola. */
const LIMITE_SR_DIAS = 22;

/**
 * Horas que faltan para que venza el SLA de una orden Lexmark — negativo
 * significa que ya venció (entre más negativo, más urgente). `null` cuando
 * no aplica (no es Lexmark) o falta el dato — en ese caso la orden no debe
 * moverse del lugar que ya le da `prioridadServicio`.
 *
 *  - WO: usa `Customer Committed Completion Date`, que Lexmark ya calcula
 *    distinto por orden (varía según el contrato de esa cuenta).
 *  - SR: ignora la fecha del import, usa `creadoEn + 22 días`.
 */
export function horasParaVencerSla(
  origen: string | null | undefined,
  datosEspecificos: DatosEspecificos,
  creadoEn: string | null | undefined,
  ahora: Date = new Date(),
): number | null {
  if (origen === "WO") {
    const fecha = parsearFechaLexmark(
      datosEspecificos?.["Customer Committed Completion Date"],
    );
    if (!fecha) return null;
    return (fecha.getTime() - ahora.getTime()) / MS_POR_HORA;
  }

  if (origen === "SR") {
    if (!creadoEn) return null;
    const creado = new Date(creadoEn);
    if (Number.isNaN(creado.getTime())) return null;
    const limite = creado.getTime() + LIMITE_SR_DIAS * 24 * MS_POR_HORA;
    return (limite - ahora.getTime()) / MS_POR_HORA;
  }

  return null;
}
