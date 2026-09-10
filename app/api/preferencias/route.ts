import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Preferencias de UI por usuario (tabla `preferencias_usuario`, RLS por dueño).
 *
 *   GET  /api/preferencias?clave=panel_layout   -> { valor }  | { valor: null }
 *   PUT  /api/preferencias  { clave, valor }    -> upsert
 *
 * `user_id` SIEMPRE sale de la sesión, nunca del body. RLS es la frontera real;
 * la validación de abajo es cortesía para dar errores claros.
 */

const CLAVES_VALIDAS = ["inicio_vista", "panel_layout"] as const;
const MAX_BYTES = 32 * 1024;

function esLayoutPanel(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    Array.isArray(o.lg) &&
    Array.isArray(o.md) &&
    Array.isArray(o.sm) &&
    Array.isArray(o.ocultos)
  );
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No hay sesión." }, { status: 401 });
  }

  const clave = new URL(request.url).searchParams.get("clave");
  if (!clave || !(CLAVES_VALIDAS as readonly string[]).includes(clave)) {
    return NextResponse.json({ error: "Clave no válida." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("preferencias_usuario")
    .select("valor")
    .eq("clave", clave)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ valor: null });
  }
  return NextResponse.json({ valor: data?.valor ?? null });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No hay sesión." }, { status: 401 });
  }

  let body: { clave?: unknown; valor?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON no válido." }, { status: 400 });
  }

  const { clave, valor } = body;
  if (typeof clave !== "string" || !(CLAVES_VALIDAS as readonly string[]).includes(clave)) {
    return NextResponse.json({ error: "Clave no válida." }, { status: 400 });
  }
  if (valor === undefined || valor === null) {
    return NextResponse.json({ error: "Falta el valor." }, { status: 400 });
  }
  if (JSON.stringify(valor).length > MAX_BYTES) {
    return NextResponse.json({ error: "El valor es demasiado grande." }, { status: 400 });
  }
  if (clave === "inicio_vista" && valor !== "panel" && valor !== "simple") {
    return NextResponse.json({ error: "Vista no válida." }, { status: 400 });
  }
  if (clave === "panel_layout" && !esLayoutPanel(valor)) {
    return NextResponse.json({ error: "Layout con forma inválida." }, { status: 400 });
  }

  const { error } = await supabase
    .from("preferencias_usuario")
    .upsert(
      { user_id: user.id, clave, valor, actualizado_en: new Date().toISOString() },
      { onConflict: "user_id,clave" },
    );

  if (error) {
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
