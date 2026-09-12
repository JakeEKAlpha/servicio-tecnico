import { NextResponse } from "next/server";
import { requerirUsuario } from "@/lib/auth/requerirSesion";

/**
 * Suscripción push del usuario actual a este dispositivo.
 *   POST   -> guarda/actualiza la suscripción del navegador que llama
 *   DELETE -> la borra (ej. si el usuario desactiva las notificaciones)
 */

export async function POST(request: Request) {
  const s = await requerirUsuario();
  if (!s.ok) return s.res;
  const { supabase, userId } = s;

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Cuerpo no es JSON válido." },
      { status: 400 },
    );
  }

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const authKey = body.keys?.auth?.trim();
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json(
      { ok: false, error: "Falta endpoint o las llaves de la suscripción." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("push_subscripciones").upsert(
    { perfil_id: userId, endpoint, p256dh, auth_key: authKey },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const s = await requerirUsuario();
  if (!s.ok) return s.res;
  const { supabase, userId } = s;

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Cuerpo no es JSON válido." },
      { status: 400 },
    );
  }

  const endpoint = body.endpoint?.trim();
  if (!endpoint) {
    return NextResponse.json({ ok: false, error: "Falta endpoint." }, { status: 400 });
  }

  // `perfil_id` acota el borrado a la suscripción del propio usuario — la
  // política de RLS ya lo exige, esto solo lo hace explícito.
  const { error } = await supabase
    .from("push_subscripciones")
    .delete()
    .eq("endpoint", endpoint)
    .eq("perfil_id", userId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
