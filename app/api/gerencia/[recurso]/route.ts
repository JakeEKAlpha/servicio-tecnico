import { NextResponse } from "next/server";
import { RECURSOS } from "@/lib/gerencia/recursos";
import { contextoGerencia, filtrarColumnas } from "@/lib/gerencia/api";

/**
 * CRUD genérico de los recursos del Panel de Gerencia.
 *   GET  /api/gerencia/:recurso        -> listar
 *   POST /api/gerencia/:recurso        -> crear (si el recurso lo permite)
 * La RLS de la BD es la que realmente autoriza (políticas `es_gerencia()`);
 * aquí solo validamos sesión, rol y la lista blanca de columnas.
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ recurso: string }> },
) {
  const { recurso } = await params;
  const cfg = RECURSOS[recurso];
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "Recurso desconocido." },
      { status: 404 },
    );
  }

  const ctx = await contextoGerencia();
  if (!ctx.ok) return ctx.res;

  const { data, error } = await ctx.supabase
    .from(cfg.tabla)
    .select("*")
    .order(cfg.orden);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, filas: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ recurso: string }> },
) {
  const { recurso } = await params;
  const cfg = RECURSOS[recurso];
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "Recurso desconocido." },
      { status: 404 },
    );
  }
  if (cfg.soloEditar) {
    return NextResponse.json(
      { ok: false, error: "Este recurso no se puede crear desde aquí." },
      { status: 400 },
    );
  }

  const ctx = await contextoGerencia();
  if (!ctx.ok) return ctx.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Cuerpo no es JSON válido." },
      { status: 400 },
    );
  }

  const fila = filtrarColumnas(body, cfg.columnas);
  if (Object.keys(fila).length === 0) {
    return NextResponse.json(
      { ok: false, error: "No mandaste datos." },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.supabase
    .from(cfg.tabla)
    .insert(fila)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.code === "42501" ? 403 : 500 },
    );
  }
  return NextResponse.json({ ok: true, fila: data });
}
