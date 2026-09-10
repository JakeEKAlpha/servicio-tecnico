import type { SupabaseClient } from "@supabase/supabase-js";
import { prioridadDe } from "@/lib/ordenes/estatus";

/**
 * Lista las órdenes visibles para el usuario (RLS filtra por zona) con el
 * nombre de ingeniero y marca resueltos, ordenadas como el `items.sort()` de
 * `reconstruirVistaGeneral()`:
 *   1) prioridad de estatus  2) numero_visita  3) fecha_eta (sin fecha al final)
 *
 * Usado por `GET /api/ordenes` y por la página del Tablero.
 */

/** Columnas que realmente consume el Tablero (evita traer los ~20 campos
 *  restantes de `ordenes`, incluidos 2 jsonb, en cada fila de la lista). */
const COLUMNAS_LISTA =
  "id, zona_id, origen, numero_orden, numero_visita, estatus, fecha_eta, hora_eta, " +
  "cliente, localidad, estado, sucursal, ingeniero_id, link_doc, link_pdf, " +
  "ingenieros(nombre), marcas(nombre)";

export type OrdenListada = {
  id: string;
  zona_id: string;
  origen: string | null;
  numero_orden: string;
  numero_visita: number | null;
  estatus: string | null;
  fecha_eta: string | null;
  hora_eta: string | null;
  cliente: string | null;
  localidad: string | null;
  estado: string | null;
  sucursal: string | null;
  ingeniero_id: string | null;
  link_doc: string | null;
  link_pdf: string | null;
  ingeniero_nombre: string | null;
  marca_nombre: string | null;
};

export async function listarOrdenes(
  supabase: SupabaseClient,
  opts: { soloActivos?: boolean } = {},
): Promise<{ ordenes: OrdenListada[]; error: string | null }> {
  let query = supabase.from("ordenes").select(COLUMNAS_LISTA);

  if (opts.soloActivos) {
    query = query.not("estatus", "in", "(Concluido,Cancelado)");
  }

  const { data: filas, error } = await query;
  if (error) {
    return { ordenes: [], error: error.message };
  }

  type Rel = { nombre: string | null } | { nombre: string | null }[] | null;
  const uno = (r: Rel) => (Array.isArray(r) ? r[0] : r)?.nombre ?? null;

  type Fila = Omit<OrdenListada, "ingeniero_nombre" | "marca_nombre"> & {
    ingenieros: Rel;
    marcas: Rel;
  };

  const ordenes = ((filas ?? []) as unknown as Fila[])
    .map(({ ingenieros, marcas, ...orden }) => ({
      ...orden,
      ingeniero_nombre: uno(ingenieros),
      marca_nombre: uno(marcas),
    }))
    .sort((a, b) => {
      const pa = prioridadDe(a.estatus);
      const pb = prioridadDe(b.estatus);
      if (pa !== pb) return pa - pb;

      const va = Number(a.numero_visita) || 1;
      const vb = Number(b.numero_visita) || 1;
      if (va !== vb) return va - vb;

      const fa = a.fecha_eta || "9999-12-31";
      const fb = b.fecha_eta || "9999-12-31";
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    }) as OrdenListada[];

  return { ordenes, error: null };
}
