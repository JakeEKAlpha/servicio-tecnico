import { NextResponse } from "next/server";
import { RECURSOS } from "@/lib/gerencia/recursos";
import { contextoGerencia, filtrarColumnas } from "@/lib/gerencia/api";

/**
 *   PATCH  /api/gerencia/:recurso/:id   -> editar
 *   DELETE /api/gerencia/:recurso/:id   -> borrar (si el recurso lo permite)
 */

async function cfgYCtx(recurso: string) {
  const cfg = RECURSOS[recurso];
  if (!cfg) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Recurso desconocido." },
        { status: 404 },
      ),
    };
  }
  const ctx = await contextoGerencia();
  if (!ctx.ok) return { error: ctx.res };
  return { cfg, supabase: ctx.supabase };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ recurso: string; id: string }> },
) {
  const { recurso, id } = await params;
  const r = await cfgYCtx(recurso);
  if (r.error) return r.error;
  const { cfg, supabase } = r;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Cuerpo no es JSON válido." },
      { status: 400 },
    );
  }

  const cambios = filtrarColumnas(body, cfg.columnas, cfg.campos);
  if (Object.keys(cambios).length === 0) {
    return NextResponse.json(
      { ok: false, error: "No mandaste cambios." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from(cfg.tabla)
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
      { ok: false, error: "No se encontró o no tienes permiso." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, fila: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ recurso: string; id: string }> },
) {
  const { recurso, id } = await params;
  const r = await cfgYCtx(recurso);
  if (r.error) return r.error;
  const { cfg, supabase } = r;

  if (cfg.soloEditar) {
    return NextResponse.json(
      { ok: false, error: "Este recurso no se puede borrar desde aquí." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from(cfg.tabla).delete().eq("id", id);
  if (error) {
    // 23503 = todavía hay filas que lo referencian (FK)
    const msg =
      error.code === "23503"
        ? "No se puede borrar: hay registros que dependen de este."
        : error.message;
    return NextResponse.json(
      { ok: false, error: msg },
      { status: error.code === "42501" ? 403 : 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
