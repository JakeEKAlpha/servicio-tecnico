import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para usar EN EL NAVEGADOR (componentes con "use client").
 *
 * Usa la URL y la anon key públicas. La anon key está pensada para exponerse
 * en el navegador: la seguridad real la aplica RLS en la base de datos.
 *
 * Llama a esta función dentro del componente, no a nivel de módulo, para que
 * cada render use la sesión que haya en las cookies en ese momento.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local",
    );
  }

  return createBrowserClient(url, anonKey);
}
