import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Perfil = {
  id: string;
  nombre: string;
  rol: "coordinador" | "ingeniero" | "almacen" | "gerencia" | "admin";
  zona_id: string | null;
  zona_nombre: string | null;
  ingeniero_id: string | null;
  debe_cambiar_password: boolean;
};

/**
 * Chequeo de sesión "real" para Server Components / layouts / páginas.
 * El proxy hace el chequeo optimista (cookie); esto valida contra Supabase y
 * trae el perfil. Memorizado por render con `cache()` para no repetir la
 * consulta en la misma petición.
 *
 * Si no hay sesión o no hay perfil, redirige a /login.
 */
export const perfilActual = cache(async (): Promise<{ perfil: Perfil }> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select(
      "id, nombre, rol, zona_id, ingeniero_id, debe_cambiar_password, zonas(nombre)",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil) {
    redirect("/login");
  }

  const { zonas, ...resto } = perfil as Record<string, unknown> & {
    zonas: unknown;
  };
  const zonaRel = (Array.isArray(zonas) ? zonas[0] : zonas) as
    | { nombre: string | null }
    | null
    | undefined;

  return {
    perfil: {
      ...resto,
      zona_nombre: zonaRel?.nombre ?? null,
    } as unknown as Perfil,
  };
});
