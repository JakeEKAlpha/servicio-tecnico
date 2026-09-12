import { NextResponse } from "next/server";
import { requerirUsuario } from "@/lib/auth/requerirSesion";
import { generarDocumento, ErrorGeneracion } from "@/lib/documentos/generar";

/**
 * Generación de Doc + PDF desde la plantilla de Google Docs.
 * Réplica de `generarDocumentoDesdeDatosDocumento()` de 03_GeneracionDocs.gs.
 *
 * Entrada:  POST { "orden_id": "<uuid>" }
 * Salida:   { ok: true, link_doc, link_pdf }
 *
 * La orden debe tener ya `ingeniero_id` y `fecha_eta` (si no, error, igual que
 * el original). No cambia el estatus de la orden — eso lo hacen los puntos 1 y 2.
 */
export async function POST(request: Request) {
  const s = await requerirUsuario();
  if (!s.ok) return s.res;
  const { supabase } = s;

  // Body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "El cuerpo de la petición no es JSON válido." },
      { status: 400 },
    );
  }
  const ordenId =
    typeof body.orden_id === "string" ? body.orden_id.trim() : "";
  if (!ordenId) {
    return NextResponse.json(
      { ok: false, error: "Falta 'orden_id'." },
      { status: 400 },
    );
  }

  try {
    const { link_doc, link_pdf } = await generarDocumento(supabase, ordenId);
    return NextResponse.json({ ok: true, link_doc, link_pdf });
  } catch (e) {
    if (e instanceof ErrorGeneracion) {
      // Requisitos de negocio no cumplidos (sin ingeniero, sin fecha, etc.)
      return NextResponse.json(
        { ok: false, error: e.message },
        { status: 422 },
      );
    }
    console.error("Error generando documento:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "Falló la generación del documento.",
        detalle: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
