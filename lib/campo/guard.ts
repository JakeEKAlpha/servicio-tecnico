import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { esRolQueVeTodo } from "@/lib/auth/roles";

export type OrdenFila = Record<string, unknown> & {
  id: string;
  estatus: string | null;
  ingeniero_id: string | null;
};

export type GuardCampo =
  | { ok: false; res: NextResponse }
  | {
      ok: true;
      supabase: SupabaseClient;
      userId: string;
      orden: OrdenFila;
      puedeEditar: boolean;
    };

/**
 * Verifica que haya sesión y que la orden `ordenId` sea del ingeniero que
 * llama (o que sea gerencia/admin en modo soporte). Devuelve la orden.
 */
export async function guardCampo(ordenId: string): Promise<GuardCampo> {
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
    .select("rol, ingeniero_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "Tu usuario no tiene perfil." },
        { status: 403 },
      ),
    };
  }

  const { data: orden } = await supabase
    .from("ordenes")
    .select("*")
    .eq("id", ordenId)
    .maybeSingle();
  if (!orden) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "Orden no encontrada." },
        { status: 404 },
      ),
    };
  }

  const esSoporte = esRolQueVeTodo(perfil.rol as string);
  const esSuya =
    !!perfil.ingeniero_id && orden.ingeniero_id === perfil.ingeniero_id;
  if (!esSoporte && !esSuya) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "Esta orden no está asignada a ti." },
        { status: 403 },
      ),
    };
  }

  const cerrada = orden.estatus === "Concluido" || orden.estatus === "Cancelado";

  return {
    ok: true,
    supabase,
    userId: user.id,
    orden: orden as OrdenFila,
    puedeEditar: !cerrada,
  };
}
