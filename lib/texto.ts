/** Conectores que se quedan en minúscula dentro de un nombre, salvo al inicio. */
const CONECTORES = new Set([
  "de", "del", "la", "las", "el", "los", "y", "en", "a", "con", "para",
]);

/**
 * "Solo primeras mayúsculas" — Título Case simple: primera letra de cada
 * palabra en mayúscula, el resto en minúscula, salvo los conectores
 * (de, la, el, y…) cuando no van al inicio. Decisión del usuario 2026-09-11:
 * se aplica solo a texto nuevo capturado desde Gerencia, nunca reescribe
 * datos existentes ni toca la captura de WO/SR o la generación de PDF.
 *
 * Nota honesta: en abreviaturas legales tipo "S.A. DE C.V." el resultado es
 * "S.a. de C.v." — no hay lista de siglas a preservar (no se pidió); si
 * hace falta afinarlo para razones sociales, es un ajuste aparte.
 */
export function primerasMayusculas(texto: string): string {
  const limpio = texto.trim().replace(/\s+/g, " ");
  if (!limpio) return limpio;
  return limpio
    .toLowerCase()
    .split(" ")
    .map((palabra, i) => {
      if (!palabra) return palabra;
      if (i > 0 && CONECTORES.has(palabra)) return palabra;
      return palabra[0].toUpperCase() + palabra.slice(1);
    })
    .join(" ");
}
