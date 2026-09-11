import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_PIEZA } from "@/lib/piezas";
import { enviarPushAPerfil } from "@/lib/push/enviar";

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

  // --- Validaciones (necesitan sucursal asignada en la orden) ---
  // 1/2 sistema: `disponible_sistema` (coordinador)   2/2 físico: `validada_almacen` (almacén)
  const campoValidacion =
    "validada_almacen" in body
      ? "validada_almacen"
      : "disponible_sistema" in body
        ? "disponible_sistema"
        : null;
  if (campoValidacion) {
    // La sucursal debe estar asignada: la revisa el almacén de esa sucursal.
    const { data: pieza0 } = await supabase
      .from("piezas_orden")
      .select("orden_id")
      .eq("id", id)
      .maybeSingle();
    if (pieza0) {
      const { data: ord } = await supabase
        .from("ordenes")
        .select("sucursal_id")
        .eq("id", pieza0.orden_id)
        .maybeSingle();
      if (!ord?.sucursal_id) {
        return NextResponse.json(
          {
            ok: false,
            error: "SIN_SUCURSAL",
            detalle:
              "Asigna primero la sucursal: la revisa el almacén de esa sucursal.",
          },
          { status: 409 },
        );
      }
    }

    const { data, error } = await supabase
      .from("piezas_orden")
      .update({ [campoValidacion]: !!body[campoValidacion] })
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

  // "Ir con pieza" (apartar): requiere sucursal asignada + las 2 validaciones.
  if (estado === "apartada") {
    const { data: pz } = await supabase
      .from("piezas_orden")
      .select("orden_id, disponible_sistema, validada_almacen")
      .eq("id", id)
      .maybeSingle();
    if (pz) {
      const { data: ord } = await supabase
        .from("ordenes")
        .select("sucursal_id")
        .eq("id", pz.orden_id)
        .maybeSingle();
      if (!ord?.sucursal_id) {
        return NextResponse.json(
          { ok: false, error: "Asigna primero la sucursal de la visita." },
          { status: 409 },
        );
      }
      if (!pz.disponible_sistema || !pz.validada_almacen) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Falta validar la pieza: disponible en sistema y confirmada por almacén.",
          },
          { status: 409 },
        );
      }
    }
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

  // Push al ingeniero: la pieza ya está lista para recoger. Un error de
  // push no debe tumbar la respuesta — la pieza ya quedó apartada de
  // verdad, avisar es una mejora, no una condición para el éxito.
  if (estado === "apartada") {
    try {
      const { data: orden } = await supabase
        .from("ordenes")
        .select("numero_orden, ingeniero_id")
        .eq("id", data.orden_id)
        .maybeSingle();
      if (orden?.ingeniero_id) {
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("id")
          .eq("ingeniero_id", orden.ingeniero_id)
          .maybeSingle();
        if (perfil) {
          await enviarPushAPerfil(supabase, perfil.id, {
            titulo: "Pieza disponible",
            cuerpo: `Ya puedes recoger la pieza de la orden ${orden.numero_orden}.`,
            url: `/campo/${data.orden_id}`,
          });
        }
      }
    } catch (e) {
      console.error("No se pudo mandar el push de pieza apartada:", e);
    }
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
