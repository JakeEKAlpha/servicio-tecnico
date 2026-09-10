import { createClient } from "@/lib/supabase/client";
import { rutaEvidencia } from "@/lib/campo/evidencias";

/**
 * Sube un archivo al bucket `evidencias` (Storage, con RLS) y registra la
 * fila en `evidencias` vía la API de campo. Devuelve la evidencia creada.
 * Para usar SOLO en componentes cliente.
 */
export async function subirEvidencia(
  ordenId: string,
  tipo: string,
  file: File,
  nota?: string,
): Promise<{ ok: true; evidencia: unknown } | { ok: false; error: string }> {
  const supabase = createClient();
  const path = rutaEvidencia(ordenId, tipo, file.name);

  const { error: upErr } = await supabase.storage
    .from("evidencias")
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (upErr) {
    return { ok: false, error: `No se pudo subir el archivo: ${upErr.message}` };
  }

  const r = await fetch(`/api/campo/${ordenId}/evidencia`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo, path, nota }),
  });
  const data = await r.json();
  if (!r.ok || !data.ok) {
    // deja el objeto huérfano en storage; el borrado lo hará la reconciliación
    return { ok: false, error: data.error ?? "No se pudo registrar la evidencia." };
  }
  return { ok: true, evidencia: data.evidencia };
}

/** URL firmada temporal para ver un objeto privado del bucket. */
export async function urlEvidencia(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage
    .from("evidencias")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
