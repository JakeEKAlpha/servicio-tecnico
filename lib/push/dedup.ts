import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dedup para los disparadores PROGRAMADOS (revisados por el cron cada
 * 15 min) — sin esto, una condición que sigue siendo cierta (ej. "sin
 * marcar salida") mandaría el mismo push cada 15 minutos para siempre.
 *
 * Los disparadores por EVENTO (asignación, pieza apartada) no usan esto:
 * se disparan una sola vez, inline, desde el código que ya hace esa acción.
 */

/** true si ya se mandó este aviso exacto (mismo tipo+clave+destinatario). */
export async function yaEnviado(
  supabase: SupabaseClient,
  tipo: string,
  clave: string,
  destinatarioPerfilId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("notificaciones_enviadas")
    .select("id")
    .eq("tipo", tipo)
    .eq("clave", clave)
    .eq("destinatario_perfil_id", destinatarioPerfilId)
    .maybeSingle();
  return !!data;
}

/** Registra que ya se mandó, para que el cron no lo repita. */
export async function marcarEnviado(
  supabase: SupabaseClient,
  tipo: string,
  clave: string,
  destinatarioPerfilId: string,
): Promise<void> {
  await supabase
    .from("notificaciones_enviadas")
    .insert({ tipo, clave, destinatario_perfil_id: destinatarioPerfilId });
}

/**
 * Manda un push programado solo si no se ha mandado antes (mismo
 * tipo+clave+destinatario) — combina el chequeo y el envío en un solo
 * paso para no repetirlo en cada disparador del cron.
 */
export async function enviarSiNuevo(
  supabase: SupabaseClient,
  tipo: string,
  clave: string,
  destinatarioPerfilId: string,
  enviar: () => Promise<void>,
): Promise<void> {
  if (await yaEnviado(supabase, tipo, clave, destinatarioPerfilId)) return;
  await enviar();
  await marcarEnviado(supabase, tipo, clave, destinatarioPerfilId);
}
