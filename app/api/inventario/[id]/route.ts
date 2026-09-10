import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 *   PATCH  /api/inventario/:id   -> ajustar cantidades / mínimo / ubicación
 *   DELETE /api/inventario/:id   -> quitar la fila de stock
 * Autorización por RLS (coordinador solo su zona; gerencia todo).
 */

const CAMPOS = [
  "cantidad_disponible",
  "cantidad_apartada",
  "stock_minimo",
  "ubicacion",
] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Cuerpo no es JSON válido." },
      { status: 400 },
    );
  }

  const cambios: Record<string, unknown> = { actualizado_en: new Date().toISOString() };
  for (const k of CAMPOS) {
    if (k in body) {
      const v = body[k];
      cambios[k] =
        k === "ubicacion"
          ? (v === "" ? null : v)
          : Math.max(0, Number(v) || 0);
    }
  }

  const { data, error } = await supabase
    .from("inventario")
    .update(cambios)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.code === "42501" ? 403 : 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { ok: false, error: "No se encontró o no es de tu zona." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, fila: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("inventario").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.code === "42501" ? 403 : 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
