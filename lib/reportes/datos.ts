/**
 * Carga de datos para la pantalla de análisis de servicios (gerencia).
 * Todo sale de `ordenes` + `ordenes_historial` — ninguna tabla ni columna
 * nueva (ver la nota en `lib/reportes/analitica.ts`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrdenAnalitica } from "@/lib/reportes/analitica";

export type FiltrosReportes = {
  desde?: string; // "YYYY-MM-DD", filtra por creado_en >=
  hasta?: string; // "YYYY-MM-DD", filtra por creado_en <= (fin de día)
  zonaId?: string;
  sucursalId?: string;
  marcaId?: string;
  ingenieroId?: string;
  origen?: string; // "WO" | "SR" | "MANUAL" | ...
  estatus?: string;
};

type RelUno<T extends Record<string, unknown>> = T | T[] | null;
function uno<T extends Record<string, unknown>>(r: RelUno<T>): T | null {
  return (Array.isArray(r) ? r[0] : r) ?? null;
}

const COLUMNAS =
  "id, numero_orden, origen, estatus, cliente, creado_en, actualizado_en, fecha_eta, " +
  "datos_especificos, " +
  "sucursales(nombre), ingenieros(nombre), marcas(nombre), contratos(tipo_contrato)";

type FilaCruda = {
  id: string;
  numero_orden: string;
  origen: string | null;
  estatus: string | null;
  cliente: string | null;
  creado_en: string;
  actualizado_en: string;
  fecha_eta: string | null;
  datos_especificos: Record<string, string> | null;
  sucursales: RelUno<{ nombre: string | null }>;
  ingenieros: RelUno<{ nombre: string | null }>;
  marcas: RelUno<{ nombre: string | null }>;
  contratos: RelUno<{ tipo_contrato: string | null }>;
};

export async function cargarOrdenesAnalitica(
  supabase: SupabaseClient,
  filtros: FiltrosReportes,
): Promise<{ ordenes: OrdenAnalitica[]; error: string | null }> {
  let query = supabase.from("ordenes").select(COLUMNAS);

  if (filtros.desde) query = query.gte("creado_en", `${filtros.desde}T00:00:00`);
  if (filtros.hasta) query = query.lte("creado_en", `${filtros.hasta}T23:59:59`);
  if (filtros.zonaId) query = query.eq("zona_id", filtros.zonaId);
  if (filtros.sucursalId) query = query.eq("sucursal_id", filtros.sucursalId);
  if (filtros.marcaId) query = query.eq("marca_id", filtros.marcaId);
  if (filtros.ingenieroId) query = query.eq("ingeniero_id", filtros.ingenieroId);
  if (filtros.origen) query = query.eq("origen", filtros.origen);
  if (filtros.estatus) query = query.eq("estatus", filtros.estatus);

  const { data, error } = await query.order("creado_en", { ascending: false });
  if (error) return { ordenes: [], error: error.message };

  const filas = (data ?? []) as unknown as FilaCruda[];
  const ids = filas.map((f) => f.id);

  // Fecha real de cierre: la transición MÁS RECIENTE a "Concluido" por orden
  // (si se reabrió y se concluyó de nuevo, es la que refleja el estatus
  // actual). Solo se pide para las órdenes ya filtradas — nada de traer
  // todo el historial.
  const concluidoPorOrden = new Map<string, string>();
  if (ids.length > 0) {
    const { data: historial } = await supabase
      .from("ordenes_historial")
      .select("orden_id, cambiado_en")
      .in("orden_id", ids)
      .eq("estatus_nuevo", "Concluido")
      .order("cambiado_en", { ascending: true });
    for (const h of (historial ?? []) as { orden_id: string; cambiado_en: string }[]) {
      concluidoPorOrden.set(h.orden_id, h.cambiado_en); // el último sobrescribe (orden ascendente)
    }
  }

  const ordenes: OrdenAnalitica[] = filas.map((f) => ({
    id: f.id,
    numero_orden: f.numero_orden,
    origen: f.origen,
    estatus: f.estatus,
    cliente: f.cliente,
    creado_en: f.creado_en,
    // Si está Concluido pero no hay fila de historial (dato viejo/insertado
    // a mano sin pasar por el trigger), usa `actualizado_en` como mejor
    // aproximación real — nunca se inventa la fecha, es una columna que ya
    // existe y que la BD actualiza en cada cambio de la fila.
    concluido_en:
      concluidoPorOrden.get(f.id) ?? (f.estatus === "Concluido" ? f.actualizado_en : null),
    fecha_eta: f.fecha_eta,
    sucursal_nombre: uno(f.sucursales)?.nombre ?? null,
    ingeniero_nombre: uno(f.ingenieros)?.nombre ?? null,
    marca_nombre: uno(f.marcas)?.nombre ?? null,
    tipo_contrato: uno(f.contratos)?.tipo_contrato ?? null,
    datos_especificos: f.datos_especificos,
  }));

  return { ordenes, error: null };
}

export type OpcionesFiltro = {
  zonas: { id: string; nombre: string }[];
  sucursales: { id: string; nombre: string }[];
  marcas: { id: string; nombre: string }[];
  ingenieros: { id: string; nombre: string }[];
};

/** Catálogos para los `<select>` de filtro — todos ya existen para otras
 *  pantallas (Tablero, Gerencia); aquí solo se piden ordenados por nombre. */
export async function cargarOpcionesFiltro(supabase: SupabaseClient): Promise<OpcionesFiltro> {
  const [zonas, sucursales, marcas, ingenieros] = await Promise.all([
    supabase.from("zonas").select("id, nombre").order("nombre"),
    supabase.from("sucursales").select("id, nombre").order("nombre"),
    supabase.from("marcas").select("id, nombre").order("nombre"),
    supabase.from("ingenieros").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  return {
    zonas: (zonas.data ?? []) as OpcionesFiltro["zonas"],
    sucursales: (sucursales.data ?? []) as OpcionesFiltro["sucursales"],
    marcas: (marcas.data ?? []) as OpcionesFiltro["marcas"],
    ingenieros: (ingenieros.data ?? []) as OpcionesFiltro["ingenieros"],
  };
}
