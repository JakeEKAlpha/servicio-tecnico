import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_PIEZA } from "@/lib/piezas";

/**
 * Piezas de una orden.
 *  GET  -> lista las piezas de la orden
 *  POST -> agrega una pieza { numero_parte, descripcion?, estado? }
 *          y la registra en el catálogo si es nueva.
 */

async function sesion(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function rolDe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", userId)
    .maybeSingle();
  return String(data?.rol ?? "");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  if (!(await sesion(supabase))) {
    return NextResponse.json(
      { ok: false, error: "No hay sesión iniciada." },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("piezas_orden")
    .select("*")
    .eq("orden_id", id)
    .order("creada_en", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "No se pudieron leer las piezas." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, piezas: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await sesion(supabase);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "No hay sesión iniciada." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON no válido." },
      { status: 400 },
    );
  }

  const numeroParte = String(body.numero_parte ?? "").trim();
  const descripcion = String(body.descripcion ?? "").trim() || null;

  // Regla del negocio: el ingeniero solo puede PEDIR piezas (en_espera).
  // El coordinador (y gerencia) dan de alta RECOMENDADAS por defecto.
  const rol = await rolDe(supabase, user.id);
  const pedido = typeof body.estado === "string" &&
    (ESTADOS_PIEZA as readonly string[]).includes(body.estado)
      ? (body.estado as string)
      : "recomendada";
  const estado = rol === "ingeniero" ? "en_espera" : pedido;

  if (!numeroParte) {
    return NextResponse.json(
      { ok: false, error: "El número de parte es obligatorio." },
      { status: 400 },
    );
  }

  const { data: pieza, error } = await supabase
    .from("piezas_orden")
    .insert({
      orden_id: id,
      numero_parte: numeroParte,
      descripcion,
      estado,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json(
        { ok: false, error: "No tienes permiso sobre esta orden." },
        { status: 403 },
      );
    }
    if (error.code === "23503") {
      return NextResponse.json(
        { ok: false, error: "La orden no existe." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "No se pudo agregar la pieza." },
      { status: 500 },
    );
  }

  // Alta en el catálogo si es nueva (ignora si ya existe).
  await supabase
    .from("piezas_catalogo")
    .upsert(
      { numero_parte: numeroParte, descripcion },
      { onConflict: "numero_parte", ignoreDuplicates: true },
    );

  return NextResponse.json({ ok: true, pieza }, { status: 201 });
}
