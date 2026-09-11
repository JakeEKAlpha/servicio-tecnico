import { createClient as createClienteBase } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la `service role key` — se salta RLS por
 * completo. SOLO para el endpoint del cron (`app/api/cron/**`), que corre
 * sin sesión de usuario (lo llama un servicio externo, cron-job.org) y
 * necesita ver/escribir en todas las zonas a la vez.
 *
 * Nunca uses esto en una ruta que responde a un usuario normal — para eso
 * es `lib/supabase/server.ts`, que respeta RLS con la sesión real.
 */
export function crearClienteCron() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }

  return createClienteBase(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
