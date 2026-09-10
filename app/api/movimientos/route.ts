import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Entradas / salidas / ajustes del almacén. Solo el encargado de esa sucursal
 * (o gerencia) puede registrarlos — lo valida la RLS de `movimientos_inventario`.
 * Un trigger (`trg_aplicar_movimiento`) actualiza el stock de `inventario`.
 *
 *   GET  /api/movimientos?sucursal_id=…   -> últimos movimientos de esa sucursal
 *   POST /api/movimientos                 -> registrar { sucursal_id, numero_parte, tipo, cantidad, motivo? }
 */

export async function GET(req: Request) {
  const supabase = await createClient();
  const sucursalId = new URL(req.url).searchParams.get("sucursal_id");
  let q = supabase
    .from("movimientos_inventario")
    .select("id, sucursal_id, numero_parte, tipo, cantidad, motivo, creado_en")
    .order("creado_en", { ascending: false })
    .limit(100);
  if (sucursalId) q = q.eq("sucursal_id", sucursalId);
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, filas: data ?? [] });
}

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

  const tipo = String(body.tipo ?? "");
  const numeroParte = String(body.numero_parte ?? "").trim().toUpperCase();
  const sucursalId = String(body.sucursal_id ?? "");
  const cantidad = Math.max(0, Math.trunc(Number(body.cantidad) || 0));

  if (!["entrada", "salida", "ajuste"].includes(tipo)) {
    return NextResponse.json(
      { ok: false, error: "Tipo inválido (entrada/salida/ajuste)." },
      { status: 400 },
    );
  }
  if (!numeroParte || !sucursalId) {
    return NextResponse.json(
      { ok: false, error: "Falta número de parte o sucursal." },
      { status: 400 },
    );
  }

  // Asegura que la pieza exista en el catálogo (por si es nueva).
  await supabase
    .from("piezas_catalogo")
    .upsert(
      { numero_parte: numeroParte },
      { onConflict: "numero_parte", ignoreDuplicates: true },
    );

  const { data, error } = await supabase
    .from("movimientos_inventario")
    .insert({
      sucursal_id: sucursalId,
      numero_parte: numeroParte,
      tipo,
      cantidad,
      motivo: (body.motivo as string) || null,
      orden_id: (body.orden_id as string) || null,
    })
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.code === "42501" ? 403 : 400 },
    );
  }
  return NextResponse.json({ ok: true, movimiento: data });
}
