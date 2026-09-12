import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/auth/sesion";

/**
 * Los dos chequeos de sesión que se repetían, copiados a mano, en ~10 route
 * handlers de `app/api/*` (auditoría 2026-09-12): "¿hay sesión?" y, cuando
 * hace falta, "¿hay sesión + perfil (rol/zona/ingeniero)?". RLS sigue siendo
 * la frontera real de seguridad — esto es la cortesía de dar un error claro
 * antes de llegar a Postgres, en un solo lugar en vez de repetido.
 */

type Fallo = { ok: false; res: NextResponse };
type ConUsuario = { ok: true; supabase: SupabaseClient; userId: string };
type ConPerfil = {
  ok: true;
  supabase: SupabaseClient;
  userId: string;
  perfil: Pick<Perfil, "rol" | "zona_id" | "ingeniero_id">;
};

/** Solo exige sesión iniciada. Para handlers que no necesitan rol/zona. */
export async function requerirUsuario(): Promise<Fallo | ConUsuario> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "No hay sesión iniciada." },
        { status: 401 },
      ),
    };
  }
  return { ok: true, supabase, userId: user.id };
}

/**
 * Exige sesión + perfil (rol, zona_id, ingeniero_id). Pasa `roles` para
 * cortar con 403 si el rol no está en la lista (ej. solo gerencia/admin).
 */
export async function requerirPerfil(opts?: {
  roles?: readonly string[];
}): Promise<Fallo | ConPerfil> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "No hay sesión iniciada." },
        { status: 401 },
      ),
    };
  }

  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles")
    .select("rol, zona_id, ingeniero_id")
    .eq("id", user.id)
    .maybeSingle();
  if (perfilError) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "No se pudo leer el perfil del usuario." },
        { status: 500 },
      ),
    };
  }
  if (!perfil) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "Tu usuario no tiene un perfil asignado." },
        { status: 403 },
      ),
    };
  }
  if (opts?.roles && !opts.roles.includes(perfil.rol as string)) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "No tienes permiso para esta acción." },
        { status: 403 },
      ),
    };
  }
  return {
    ok: true,
    supabase,
    userId: user.id,
    perfil: perfil as ConPerfil["perfil"],
  };
}
