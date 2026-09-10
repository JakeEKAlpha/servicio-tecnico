import { NextResponse } from "next/server";
import { guardCampo } from "@/lib/campo/guard";
import { TIPOS_EVIDENCIA_VALIDOS } from "@/lib/campo/evidencias";

/**
 * Evidencias de campo. El archivo ya se subió al bucket `evidencias` desde el
 * navegador (Storage con RLS); aquí solo se registra / borra la fila.
 *
 *  POST   { tipo, path, nota? }   -> registra la evidencia
 *  DELETE ?id=<uuid>             -> borra la fila (y el objeto del bucket)
 */
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
    return NextResponse.json({ ok: false, error: "JSON no válido." }, { status: 400 });
  }

  const tipo = String(body.tipo ?? "");
  const path = String(body.path ?? "");
  if (!TIPOS_EVIDENCIA_VALIDOS.includes(tipo)) {
    return NextResponse.json(
      { ok: false, error: "Tipo de evidencia inválido." },
      { status: 400 },
    );
  }
  if (!path.startsWith(`${ordenId}/`)) {
    return NextResponse.json(
      { ok: false, error: "La ruta del archivo no corresponde a esta orden." },
      { status: 400 },
    );
  }

  // Tipos de una sola foto: reemplaza la anterior.
  if (tipo === "llegada" || tipo === "os_firmada") {
    const { data: previas } = await g.supabase
      .from("evidencias")
      .select("id, url")
      .eq("orden_id", ordenId)
      .eq("tipo", tipo);
    for (const p of previas ?? []) {
      await g.supabase.storage.from("evidencias").remove([p.url as string]);
      await g.supabase.from("evidencias").delete().eq("id", p.id);
    }
  }

  const { data, error } = await g.supabase
    .from("evidencias")
    .insert({
      orden_id: ordenId,
      tipo,
      url: path,
      nota:
        typeof body.nota === "string" && body.nota.trim()
          ? body.nota.trim()
          : null,
    })
    .select()
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "No se pudo registrar." },
      { status: error ? 500 : 400 },
    );
  }
  return NextResponse.json({ ok: true, evidencia: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ordenId: string }> },
) {
  const { ordenId } = await params;
  const g = await guardCampo(ordenId);
  if (!g.ok) return g.res;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
  }

  const { data: ev } = await g.supabase
    .from("evidencias")
    .select("id, url")
    .eq("id", id)
    .eq("orden_id", ordenId)
    .maybeSingle();
  if (!ev) {
    return NextResponse.json(
      { ok: false, error: "Evidencia no encontrada." },
      { status: 404 },
    );
  }

  await g.supabase.storage.from("evidencias").remove([ev.url as string]);
  const { error } = await g.supabase.from("evidencias").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
