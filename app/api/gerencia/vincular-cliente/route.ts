import { NextResponse } from "next/server";
import { contextoGerencia } from "@/lib/gerencia/api";

/**
 * Vinculación manual de una orden a un cliente — el complemento humano del
 * backfill automático (`/api/gerencia/backfill-clientes`). El matching por
 * texto no puede saber que "DHL EXPRESS MEXICO" y "DHL METROPOLITAN
 * LOGISTICS" son la misma cuenta, o que "AUTOZONE MEXICO" corresponde a un
 * cliente que aún no existe en el directorio — eso requiere que una persona
 * lo confirme. Este endpoint es ese "sí, es este" desde la interfaz.
 *
 * Body: { ordenId: string, clienteId: string }
 */
export async function POST(request: Request) {
  const ctx = await contextoGerencia();
  if (!ctx.ok) return ctx.res;
  const { supabase } = ctx;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "El cuerpo de la petición no es JSON válido." },
      { status: 400 },
    );
  }

  const ordenId = typeof body.ordenId === "string" ? body.ordenId.trim() : "";
  const clienteId = typeof body.clienteId === "string" ? body.clienteId.trim() : "";
  if (!ordenId || !clienteId) {
    return NextResponse.json(
      { ok: false, error: "Faltan ordenId o clienteId." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("ordenes")
    .update({ cliente_id: clienteId })
    .eq("id", ordenId);

  if (error) {
    // 23503 = foreign_key_violation (clienteId no existe).
    if (error.code === "23503") {
      return NextResponse.json(
        { ok: false, error: "Ese cliente no existe." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
