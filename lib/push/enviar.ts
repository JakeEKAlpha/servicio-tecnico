import type { SupabaseClient } from "@supabase/supabase-js";
import { mandarPush, type PayloadPush } from "@/lib/push/webpush";

/**
 * Manda un push a TODAS las suscripciones (dispositivos) de un perfil, y
 * borra las que el navegador ya dio de baja (410/404). Nunca lanza — un
 * error de push no debe tumbar la acción real (asignar, recibir pieza...).
 */
export async function enviarPushAPerfil(
  supabase: SupabaseClient,
  perfilId: string,
  payload: PayloadPush,
): Promise<void> {
  const { data: subs } = await supabase
    .from("push_subscripciones")
    .select("id, endpoint, p256dh, auth_key")
    .eq("perfil_id", perfilId);

  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      const r = await mandarPush(sub, payload);
      if (!r.ok && r.expirada) {
        await supabase.from("push_subscripciones").delete().eq("id", sub.id);
      }
    }),
  );
}

/**
 * Manda un push a todos los perfiles con un rol dado (opcionalmente
 * acotado a una zona) — para "coordinación" o "gerencia" como destinatario.
 */
export async function enviarPushARol(
  supabase: SupabaseClient,
  opts: { roles: string[]; zonaId?: string | null },
  payload: PayloadPush,
): Promise<void> {
  let query = supabase.from("perfiles").select("id").in("rol", opts.roles);
  if (opts.zonaId) query = query.eq("zona_id", opts.zonaId);

  const { data: perfiles } = await query;
  if (!perfiles || perfiles.length === 0) return;

  await Promise.all(
    perfiles.map((p) => enviarPushAPerfil(supabase, p.id as string, payload)),
  );
}
