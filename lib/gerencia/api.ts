import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { primerasMayusculas } from "@/lib/texto";
import type { Campo } from "./recursos";

/**
 * Verifica que quien llama sea gerencia/admin. Devuelve el cliente de
 * Supabase listo o una respuesta de error para cortar el handler.
 */
export async function contextoGerencia(): Promise<
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; res: NextResponse }
> {
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
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || !esRolQueVeTodo(perfil.rol as string)) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "Esta acción es solo para gerencia." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, supabase };
}

/**
 * Deja pasar solo las claves permitidas por la config del recurso.
 * Si se pasa `campos`, los de `tipo: "text"` se normalizan a "primeras
 * mayúsculas" (decisión del usuario 2026-09-11) — nunca los de tipo `area`
 * (notas/indicaciones, son prosa, no nombres) ni los demás tipos.
 */
export function filtrarColumnas(
  body: Record<string, unknown>,
  columnas: string[],
  campos?: Campo[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of columnas) {
    if (k in body) {
      let v = body[k];
      if (typeof v === "string") {
        const esTexto = campos?.find((c) => c.k === k)?.tipo === "text";
        v = esTexto ? primerasMayusculas(v) : v.trim();
      }
      // "" en un campo opcional -> null (uuid, números, etc. no aceptan "")
      out[k] = v === "" ? null : v;
    }
  }
  return out;
}
