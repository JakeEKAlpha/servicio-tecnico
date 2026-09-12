import { NextResponse } from "next/server";
import { requerirPerfil } from "@/lib/auth/requerirSesion";
import { parsearReporteLexmark } from "@/lib/importar/lexmark";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { MARCA_LEXMARK_ID } from "@/lib/marcas";

/**
 * Importación de órdenes desde el reporte WO/SR de Lexmark (texto pegado,
 * sin encabezados, 28 columnas en orden fijo).
 *
 * Equivale a `agregarFilaCruda()` + `importarDesdeHoja()` de 02_Automatizacion.gs,
 * pero SIN la hoja de staging (`DATOS_CRUDOS_*`): el texto se transforma en
 * `lib/importar/lexmark.ts` y se inserta directo en `ordenes`.
 *
 * Entrada:  POST { "texto": "<filas pegadas>", "zona_id": "<solo gerencia/admin>" }
 *
 * El tipo se detecta por la primera celda: "1-…" -> SR/proactiva, dígitos -> WO.
 */

export async function POST(request: Request) {
  const s = await requerirPerfil();
  if (!s.ok) return s.res;
  const { supabase, perfil } = s;

  // 2) Body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "El cuerpo de la petición no es JSON válido." },
      { status: 400 },
    );
  }

  const texto = typeof body.texto === "string" ? body.texto : "";
  if (!texto.trim()) {
    return NextResponse.json(
      { ok: false, error: "Pega el reporte WO/SR en el campo 'texto'." },
      { status: 400 },
    );
  }

  // 3) Zona destino (igual que POST /api/ordenes)
  const veTodo = esRolQueVeTodo(perfil.rol as string);
  let zonaId = perfil.zona_id as string | null;
  const zonaIdBody =
    typeof body.zona_id === "string" && body.zona_id.trim() !== ""
      ? body.zona_id.trim()
      : null;
  if (veTodo) {
    if (!zonaIdBody) {
      return NextResponse.json(
        {
          ok: false,
          error: "Como gerencia/admin debes indicar la zona (zona_id).",
        },
        { status: 400 },
      );
    }
    zonaId = zonaIdBody;
  } else if (zonaIdBody && zonaIdBody !== zonaId) {
    return NextResponse.json(
      { ok: false, error: "No puedes importar órdenes en otra zona." },
      { status: 403 },
    );
  }
  if (!zonaId) {
    return NextResponse.json(
      { ok: false, error: "Tu perfil no tiene una zona asignada." },
      { status: 403 },
    );
  }

  // 4) Parsear el texto pegado
  const parseo = parsearReporteLexmark(texto);
  if (!parseo.ok) {
    return NextResponse.json(
      { ok: false, error: parseo.error },
      { status: 400 },
    );
  }

  if (parseo.filas.length === 0) {
    return NextResponse.json({
      ok: true,
      tipo: parseo.origen,
      total_en_texto: 0,
      insertadas: 0,
      omitidas_duplicadas: 0,
      aviso: "No se encontró ninguna fila con número de orden.",
    });
  }

  // 5) Insertar. upsert + ignoreDuplicates: el UNIQUE
  //    (zona_id, numero_orden, numero_visita) descarta de forma atómica las
  //    órdenes que ya existen (sin condición de carrera con otra importación).
  const candidatas = parseo.filas.map((f) => ({
    ...f,
    zona_id: zonaId,
    marca_id: MARCA_LEXMARK_ID,
  }));

  const { data: insertadas, error: insertError } = await supabase
    .from("ordenes")
    .upsert(candidatas, {
      onConflict: "zona_id,numero_orden,numero_visita",
      ignoreDuplicates: true,
    })
    .select("numero_orden");

  if (insertError) {
    if (insertError.code === "42501") {
      return NextResponse.json(
        { ok: false, error: "No tienes permiso para importar en esta zona." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudieron importar las órdenes.",
        detalle: insertError.message,
      },
      { status: 500 },
    );
  }

  const nInsertadas = insertadas?.length ?? 0;
  return NextResponse.json({
    ok: true,
    tipo: parseo.origen,
    total_en_texto: parseo.filas.length,
    insertadas: nInsertadas,
    omitidas_duplicadas: parseo.filas.length - nInsertadas,
    filas_ignoradas: parseo.ignoradas,
  });
}
