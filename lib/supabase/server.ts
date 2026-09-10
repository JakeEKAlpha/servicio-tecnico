import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para usar EN EL SERVIDOR (Server Components, Route
 * Handlers y Server Actions).
 *
 * Lee la sesión del usuario desde las cookies de la petición, así que RLS se
 * aplica con el usuario correcto. En Next.js 16 `cookies()` es asíncrono, por
 * eso esta función es `async` y hay que llamarla con `await`.
 *
 * Crea SIEMPRE un cliente nuevo por cada petición; nunca lo guardes en una
 * variable compartida entre peticiones.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // `setAll` fue llamado desde un Server Component, donde no se pueden
          // escribir cookies. Es seguro ignorarlo si el refresco de sesión se
          // hace en un proxy/middleware (lo agregaremos en una fase posterior).
        }
      },
    },
  });
}
