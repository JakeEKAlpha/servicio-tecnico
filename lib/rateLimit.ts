import { headers } from "next/headers";

/**
 * Rate limit simple en memoria, por IP. Deliberadamente sin dependencias
 * nuevas ni servicio externo (Upstash/Redis) — para ~10 usuarios internos es
 * suficiente y no agrega otra cuenta de paga que mantener.
 *
 * Límite real conocido: en Vercel (serverless) cada instancia de la función
 * tiene su propia memoria — con tráfico bajo casi siempre es la misma
 * instancia (por eso sigue siendo útil), pero bajo carga alta el límite
 * efectivo puede ser un múltiplo del configurado, no un tope exacto. Si algún
 * día hay abuso real que esto no frene, la solución es un store compartido
 * (Upstash/Vercel KV), no ajustar este número.
 */

type Bucket = { cuenta: number; venceEn: number };
const buckets = new Map<string, Bucket>();

// Poda ocasional para no acumular memoria indefinidamente entre despliegues
// de la misma instancia (una función serverless puede vivir varios minutos).
let ultimaPoda = Date.now();
function podarSiToca(ahora: number) {
  if (ahora - ultimaPoda < 60_000) return;
  ultimaPoda = ahora;
  for (const [k, b] of buckets) if (b.venceEn <= ahora) buckets.delete(k);
}

/**
 * `true` si la petición para `clave` debe rechazarse (ya superó `limite`
 * intentos en los últimos `ventanaMs`). Cada llamada que no rechaza cuenta
 * como un intento.
 */
export function excedeLimite(
  clave: string,
  limite: number,
  ventanaMs: number,
): boolean {
  const ahora = Date.now();
  podarSiToca(ahora);

  const actual = buckets.get(clave);
  if (!actual || actual.venceEn <= ahora) {
    buckets.set(clave, { cuenta: 1, venceEn: ahora + ventanaMs });
    return false;
  }
  actual.cuenta += 1;
  return actual.cuenta > limite;
}

/** IP del caller — `x-forwarded-for` (Vercel/proxies) o "desconocida". */
export async function ipDeLaPeticion(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "desconocida";
}
