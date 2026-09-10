import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Stock de piezas por sucursal. La autorización la hace la RLS de la tabla
 * `inventario`: gerencia ve/edita todo; un coordinador solo el inventario de
 * las sucursales de su zona.
 *
 *   GET  /api/inventario            -> lista (ya filtrada por RLS)
 *   POST /api/inventario            -> alta { numero_parte, sucursal_id, ... }
 */

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventario")
    .select(
      "id, numero_parte, sucursal_id, cantidad_disponible, cantidad_apartada, stock_minimo, ubicacion, piezas_catalogo(descripcion), sucursales(nombre)",
    )
    .order("numero_parte");
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, filas: data ?? [] });
}

const CAMPOS = [
  "numero_parte",
  "sucursal_id",
  "cantidad_disponible",
  "cantidad_apartada",
  "stock_minimo",
  "ubicacion",
] as const;

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "No hay sesión iniciada." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Cuerpo no es JSON válido." },
      { status: 400 },
    );
  }

  const fila: Record<string, unknown> = {};
  for (const k of CAMPOS) if (k in body) fila[k] = body[k] === "" ? null : body[k];

  if (!fila.numero_parte || !fila.sucursal_id) {
    return NextResponse.json(
      { ok: false, error: "Falta número de parte o sucursal." },
      { status: 400 },
    );
  }

  // Alta también en el catálogo si la pieza es nueva.
  await supabase
    .from("piezas_catalogo")
    .upsert(
      { numero_parte: fila.numero_parte as string },
      { onConflict: "numero_parte", ignoreDuplicates: true },
    );

  const { data, error } = await supabase
    .from("inventario")
    .insert(fila)
    .select()
    .maybeSingle();

  if (error) {
    const msg =
      error.code === "23505"
        ? "Esa pieza ya está registrada en esa sucursal."
        : error.message;
    return NextResponse.json(
      { ok: false, error: msg },
      { status: error.code === "42501" ? 403 : 400 },
    );
  }
  return NextResponse.json({ ok: true, fila: data });
}
