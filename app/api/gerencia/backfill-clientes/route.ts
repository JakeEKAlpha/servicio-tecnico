import { NextResponse } from "next/server";
import { contextoGerencia } from "@/lib/gerencia/api";
import { mejorCoincidenciaCliente } from "@/lib/cuentas/directorio";

/**
 * Backfill de un solo uso: `blueprints/cerrar-deuda-datos-blueprint.md`, Paso 2.
 *
 * Vincula cada orden histórica sin `cliente_id` a la cuenta de `clientes`
 * que mejor coincide con su texto libre `cliente` (misma lógica de puntaje
 * que ya usa `cuentaDeOrden()` para resolver la ficha en el tablero — ver
 * `lib/cuentas/directorio.ts`). Solo gerencia/admin puede correrlo, porque
 * escribe en órdenes de todas las zonas (RLS `ordenes_upd` lo exige).
 *
 * Idempotente: solo toca `where cliente_id is null`, así que correrlo dos
 * veces no repite ni deshace nada — la segunda vez procesa únicamente lo que
 * no encontró match la primera.
 */
export async function POST() {
  const ctx = await contextoGerencia();
  if (!ctx.ok) return ctx.res;
  const { supabase } = ctx;

  const [{ data: ordenes, error: errOrdenes }, { data: clientes, error: errClientes }] =
    await Promise.all([
      supabase.from("ordenes").select("id, cliente").is("cliente_id", null),
      supabase.from("clientes").select("id, nombre").eq("activo", true),
    ]);

  if (errOrdenes || errClientes) {
    return NextResponse.json(
      { ok: false, error: (errOrdenes ?? errClientes)!.message },
      { status: 500 },
    );
  }

  const candidatas = (clientes ?? []) as { id: string; nombre: string }[];
  const vinculables: { id: string; cliente: string; clienteId: string }[] = [];
  const sinMatch: { id: string; cliente: string }[] = [];

  for (const o of (ordenes ?? []) as { id: string; cliente: string | null }[]) {
    const match = mejorCoincidenciaCliente(candidatas, o.cliente);
    if (match) {
      vinculables.push({ id: o.id, cliente: o.cliente ?? "", clienteId: match.id });
    } else {
      sinMatch.push({ id: o.id, cliente: o.cliente ?? "" });
    }
  }

  // Un UPDATE por fila: Supabase JS no ofrece un bulk-update con un valor
  // distinto por fila sin pasar por `upsert` (que exigiría mandar todas las
  // columnas NOT NULL de `ordenes`, fuera de alcance de este backfill). El
  // volumen es el de las órdenes históricas de este negocio, no millones.
  const errores: { id: string; error: string }[] = [];
  for (const v of vinculables) {
    const { error } = await supabase
      .from("ordenes")
      .update({ cliente_id: v.clienteId })
      .eq("id", v.id);
    if (error) errores.push({ id: v.id, error: error.message });
  }

  return NextResponse.json({
    ok: true,
    procesadas: (ordenes ?? []).length,
    vinculadas: vinculables.length - errores.length,
    sinMatch,
    ...(errores.length > 0 ? { errores } : {}),
  });
}
