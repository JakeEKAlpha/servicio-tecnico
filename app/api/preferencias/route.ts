import { NextResponse } from "next/server";
import { requerirUsuario } from "@/lib/auth/requerirSesion";
import {
  IDS_COLUMNAS_TABLERO,
  IDS_OCULTABLES,
  ANCHO_MAX,
  anchoMinDe,
} from "@/lib/ordenes/columnasTablero";

/**
 * Preferencias de UI por usuario (tabla `preferencias_usuario`, RLS por dueño).
 *
 *   GET  /api/preferencias?clave=panel_layout   -> { valor }  | { valor: null }
 *   PUT  /api/preferencias  { clave, valor }    -> upsert
 *
 * `user_id` SIEMPRE sale de la sesión, nunca del body. RLS es la frontera real;
 * la validación de abajo es cortesía para dar errores claros.
 */

const CLAVES_VALIDAS = [
  "inicio_vista",
  "panel_layout",
  "reportes_filtros",
  "tablero_vista",
  "tablero_columnas_ocultas",
  "tablero_columnas_anchos",
] as const;
const MAX_BYTES = 32 * 1024;

function esLayoutPanel(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    Array.isArray(o.lg) &&
    Array.isArray(o.md) &&
    Array.isArray(o.sm) &&
    Array.isArray(o.ocultos)
  );
}

/** Todos los campos son opcionales y, si están, deben ser texto — mismas
 *  claves que `FiltrosReportes` en `/gerencia/reportes`. */
const CAMPOS_FILTROS_REPORTES = [
  "desde",
  "hasta",
  "zona",
  "sucursal",
  "marca",
  "ingeniero",
  "origen",
  "estatus",
] as const;

export function esFiltrosReportes(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return Object.keys(o).every(
    (k) =>
      (CAMPOS_FILTROS_REPORTES as readonly string[]).includes(k) &&
      typeof o[k] === "string",
  );
}

function esColumnasOcultas(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.every((x) => typeof x === "string" && (IDS_OCULTABLES as string[]).includes(x))
  );
}

function esColumnasAnchos(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return Object.entries(o).every(
    ([id, ancho]) =>
      (IDS_COLUMNAS_TABLERO as string[]).includes(id) &&
      typeof ancho === "number" &&
      ancho >= anchoMinDe(id) &&
      ancho <= ANCHO_MAX,
  );
}

export async function GET(request: Request) {
  const s = await requerirUsuario();
  if (!s.ok) return s.res;
  const { supabase } = s;

  const clave = new URL(request.url).searchParams.get("clave");
  if (!clave || !(CLAVES_VALIDAS as readonly string[]).includes(clave)) {
    return NextResponse.json({ error: "Clave no válida." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("preferencias_usuario")
    .select("valor")
    .eq("clave", clave)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ valor: null });
  }
  return NextResponse.json({ valor: data?.valor ?? null });
}

export async function PUT(request: Request) {
  const s = await requerirUsuario();
  if (!s.ok) return s.res;
  const { supabase, userId } = s;

  let body: { clave?: unknown; valor?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON no válido." }, { status: 400 });
  }

  const { clave, valor } = body;
  if (typeof clave !== "string" || !(CLAVES_VALIDAS as readonly string[]).includes(clave)) {
    return NextResponse.json({ error: "Clave no válida." }, { status: 400 });
  }
  if (valor === undefined || valor === null) {
    return NextResponse.json({ error: "Falta el valor." }, { status: 400 });
  }
  if (JSON.stringify(valor).length > MAX_BYTES) {
    return NextResponse.json({ error: "El valor es demasiado grande." }, { status: 400 });
  }
  if (clave === "inicio_vista" && valor !== "panel" && valor !== "simple") {
    return NextResponse.json({ error: "Vista no válida." }, { status: 400 });
  }
  if (clave === "tablero_vista" && valor !== "tabla" && valor !== "tarjetas") {
    return NextResponse.json({ error: "Vista no válida." }, { status: 400 });
  }
  if (clave === "tablero_columnas_ocultas" && !esColumnasOcultas(valor)) {
    return NextResponse.json({ error: "Columnas ocultas con forma inválida." }, { status: 400 });
  }
  if (clave === "tablero_columnas_anchos" && !esColumnasAnchos(valor)) {
    return NextResponse.json({ error: "Anchos de columna con forma inválida." }, { status: 400 });
  }
  if (clave === "panel_layout" && !esLayoutPanel(valor)) {
    return NextResponse.json({ error: "Layout con forma inválida." }, { status: 400 });
  }
  if (clave === "reportes_filtros" && !esFiltrosReportes(valor)) {
    return NextResponse.json({ error: "Filtros con forma inválida." }, { status: 400 });
  }

  const { error } = await supabase
    .from("preferencias_usuario")
    .upsert(
      { user_id: userId, clave, valor, actualizado_en: new Date().toISOString() },
      { onConflict: "user_id,clave" },
    );

  if (error) {
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
