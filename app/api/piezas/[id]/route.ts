import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_PIEZA } from "@/lib/piezas";

/**
 * Una pieza concreta.
 *  PATCH { estado }               -> cambia el estado (el trigger mueve el stock)
 *  PATCH { validada_almacen }     -> el almacén confirma existencia física
 *  PATCH { resolver }             -> pieza apartada NO usada: stock|retiro|retorno|devolver
 *  DELETE                         -> borra la pieza
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON no válido." },
      { status: 400 },
    );
  }

  // --- Resolver pieza apartada no usada (RPC con permisos internos) ---
  if (typeof body.resolver === "string") {
    const modo = body.resolver;
    if (!["stock", "retiro", "retorno", "devolver"].includes(modo)) {
      return NextResponse.json(
        { ok: false, error: "Modo inválido." },
        { status: 400 },
      );
    }
    const { data, error } = await supabase.rpc("resolver_pieza_no_usada", {
      p_pieza: id,
      p_modo: modo,
    });
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, pieza: data });
  }

  // --- Validación de almacén ---
  if ("validada_almacen" in body) {
    const { data, error } = await supabase
      .from("piezas_orden")
      .update({ validada_almacen: !!body.validada_almacen })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "Pieza no encontrada." },
        { status: error ? 500 : 404 },
      );
    }
    return NextResponse.json({ ok: true, pieza: data });
  }

  // --- Cambio de estado ---
  const estado = String(body.estado ?? "");
  if (!(ESTADOS_PIEZA as readonly string[]).includes(estado)) {
    return NextResponse.json(
      { ok: false, error: "Estado de pieza no válido." },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = { estado };
  if (estado === "recibida") {
    update.recibida_en = new Date().toISOString();
    update.recibida_por = user.id;
  }

  const { data, error } = await supabase
    .from("piezas_orden")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message ?? "No se pudo actualizar la pieza." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { ok: false, error: "Pieza no encontrada o sin permiso." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, pieza: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const { error } = await supabase.from("piezas_orden").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { ok: false, error: "No se pudo borrar la pieza." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
