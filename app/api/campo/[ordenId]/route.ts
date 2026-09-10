import { NextResponse } from "next/server";
import { guardCampo } from "@/lib/campo/guard";
import { horaMx } from "@/lib/fechas";
import { normalizarChecklist } from "@/lib/campo/checklist";
import { generarDocumento } from "@/lib/documentos/generar";

/**
 * Acciones de la app de campo sobre una orden.
 *
 *  PATCH  { checklist?, contador_mono?, contador_color?, diagnostico_campo? }
 *         -> guarda avances del servicio en sitio.
 *
 *  POST   { accion: "iniciar", lat?, lng? }
 *         -> sella hora_inicio_real (México) + GPS. Solo la primera vez.
 *
 *  POST   { accion: "generar_os", estatus_final: "Concluido" | "Pendiente" }
 *         -> sella hora_fin_real (= ahora + 7 min, como el sistema viejo),
 *            guarda el estatus elegido y genera el Doc + PDF.
 *
 *  POST   { accion: "cerrar" }
 *         -> marca la orden Concluido / Pendiente (según lo elegido al
 *            generar la OS). Requiere que ya exista la evidencia "os_firmada".
 */

const ESTATUS_FINALES = ["Concluido", "Pendiente"] as const;

function intONull(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ordenId: string }> },
) {
  const { ordenId } = await params;
  const g = await guardCampo(ordenId);
  if (!g.ok) return g.res;
  if (!g.puedeEditar) {
    return NextResponse.json(
      { ok: false, error: "La orden ya está cerrada." },
      { status: 409 },
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

  const update: Record<string, unknown> = {};
  if ("checklist" in body) update.checklist = normalizarChecklist(body.checklist);
  if ("contador_mono" in body) update.contador_mono = intONull(body.contador_mono);
  if ("contador_color" in body)
    update.contador_color = intONull(body.contador_color);
  if ("diagnostico_campo" in body)
    update.diagnostico_campo =
      typeof body.diagnostico_campo === "string"
        ? body.diagnostico_campo.trim() || null
        : null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nada que guardar." },
      { status: 400 },
    );
  }

  const { data, error } = await g.supabase
    .from("ordenes")
    .update(update)
    .eq("id", ordenId)
    .select("checklist, contador_mono, contador_color, diagnostico_campo")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "No se pudo guardar." },
      { status: error ? 500 : 404 },
    );
  }
  return NextResponse.json({ ok: true, orden: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ordenId: string }> },
) {
  const { ordenId } = await params;
  const g = await guardCampo(ordenId);
  if (!g.ok) return g.res;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON no válido." },
      { status: 400 },
    );
  }
  const accion = String(body.accion ?? "");

  // ---- Iniciar servicio: hora de llegada + GPS ----
  if (accion === "iniciar") {
    if (!g.puedeEditar) {
      return NextResponse.json(
        { ok: false, error: "La orden ya está cerrada." },
        { status: 409 },
      );
    }
    if (g.orden.hora_inicio_real) {
      return NextResponse.json(
        { ok: false, error: "El servicio ya se había iniciado." },
        { status: 409 },
      );
    }
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const update: Record<string, unknown> = { hora_inicio_real: horaMx() };
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      update.lat_inicio = lat;
      update.lng_inicio = lng;
    }
    const { data, error } = await g.supabase
      .from("ordenes")
      .update(update)
      .eq("id", ordenId)
      .select("hora_inicio_real, lat_inicio, lng_inicio")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "No se pudo iniciar." },
        { status: error ? 500 : 404 },
      );
    }
    return NextResponse.json({ ok: true, orden: data });
  }

  // ---- Generar orden de servicio ----
  if (accion === "generar_os") {
    if (!g.puedeEditar) {
      return NextResponse.json(
        { ok: false, error: "La orden ya está cerrada." },
        { status: 409 },
      );
    }
    if (!g.orden.hora_inicio_real) {
      return NextResponse.json(
        { ok: false, error: "Primero inicia el servicio." },
        { status: 409 },
      );
    }
    const estatusFinal = String(body.estatus_final ?? "Concluido");
    if (!(ESTATUS_FINALES as readonly string[]).includes(estatusFinal)) {
      return NextResponse.json(
        { ok: false, error: "Estatus final inválido." },
        { status: 400 },
      );
    }

    // hora_fin = ahora + 7 min (réplica del sistema viejo)
    const finMas7 = new Date(Date.now() + 7 * 60 * 1000);

    const { error: updErr } = await g.supabase
      .from("ordenes")
      .update({ hora_fin_real: horaMx(finMas7) })
      .eq("id", ordenId);
    if (updErr) {
      return NextResponse.json(
        { ok: false, error: updErr.message },
        { status: 500 },
      );
    }

    // Genera Doc + PDF con la misma cuenta de servicio de siempre.
    try {
      const doc = await generarDocumento(g.supabase, ordenId);
      return NextResponse.json({
        ok: true,
        estatus_final: estatusFinal,
        hora_fin: horaMx(finMas7),
        ...doc,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        {
          ok: true,
          estatus_final: estatusFinal,
          hora_fin: horaMx(finMas7),
          aviso: "La hora de cierre se guardó pero el documento no se generó: " + msg,
        },
      );
    }
  }

  // ---- Cerrar ticket (tras subir la OS firmada) ----
  if (accion === "cerrar") {
    const estatusFinal = String(body.estatus_final ?? "Concluido");
    if (!(ESTATUS_FINALES as readonly string[]).includes(estatusFinal)) {
      return NextResponse.json(
        { ok: false, error: "Estatus final inválido." },
        { status: 400 },
      );
    }

    const { count } = await g.supabase
      .from("evidencias")
      .select("id", { count: "exact", head: true })
      .eq("orden_id", ordenId)
      .eq("tipo", "os_firmada");
    if (!count) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sube primero la foto de la orden de servicio firmada.",
        },
        { status: 409 },
      );
    }

    const { data, error } = await g.supabase
      .from("ordenes")
      .update({ estatus: estatusFinal })
      .eq("id", ordenId)
      .select("id, estatus")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "No se pudo cerrar." },
        { status: error ? 500 : 404 },
      );
    }
    return NextResponse.json({ ok: true, orden: data });
  }

  return NextResponse.json(
    { ok: false, error: "Acción no reconocida." },
    { status: 400 },
  );
}
