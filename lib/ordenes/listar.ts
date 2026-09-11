import type { SupabaseClient } from "@supabase/supabase-js";
import { prioridadDe, prioridadServicio } from "@/lib/ordenes/estatus";
import { horasParaVencerSla } from "@/lib/ordenes/sla";

/**
 * Lista las órdenes visibles para el usuario (RLS filtra por zona) con el
 * nombre de ingeniero y marca resueltos, ordenadas:
 *   1) prioridad de estatus  2) prioridad de tipo de servicio (WO Lexmark >
 *      Xerox > SR Lexmark > Renta > Garantía/Póliza > TyM > resto, ver
 *      `prioridadServicio`)  3) urgencia de SLA Lexmark (qué tan cerca está
 *      de vencer — desempata dentro del mismo tipo de servicio, ver
 *      `horasParaVencerSla`)  4) numero_visita  5) fecha_eta (sin fecha al
 *      final)
 *
 * Usado por `GET /api/ordenes` y por la página del Tablero.
 */

/** Columnas que realmente consume el Tablero. `datos_especificos` y
 *  `creado_en` se traen a propósito (antes se evitaban por ser el jsonb más
 *  pesado) — los necesita `horasParaVencerSla` para ordenar por urgencia. */
const COLUMNAS_LISTA =
  "id, zona_id, origen, numero_orden, numero_visita, estatus, fecha_eta, hora_eta, " +
  "cliente, localidad, estado, sucursal, ingeniero_id, link_doc, link_pdf, " +
  "datos_especificos, creado_en, " +
  "ingenieros(nombre), marcas(nombre), contratos(tipo_contrato)";

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
  /** Horas para vencer el SLA Lexmark — mismo cálculo que ordena la cola
   *  (`horasParaVencerSla`), expuesto para pintar la insignia en la UI
   *  (`badgeSla`). `null` = no aplica (no es Lexmark) o falta el dato. */
  horas_sla: number | null;
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

  type RelContrato =
    | { tipo_contrato: string | null }
    | { tipo_contrato: string | null }[]
    | null;
  const tipoDe = (r: RelContrato) => (Array.isArray(r) ? r[0] : r)?.tipo_contrato ?? null;

  type Fila = Omit<OrdenListada, "ingeniero_nombre" | "marca_nombre"> & {
    ingenieros: Rel;
    marcas: Rel;
    contratos: RelContrato;
    datos_especificos: Record<string, string> | null;
    creado_en: string | null;
  };

  const ahora = new Date();

  const ordenes = ((filas ?? []) as unknown as Fila[])
    .map(({ ingenieros, marcas, contratos, ...orden }) => ({
      ...orden,
      ingeniero_nombre: uno(ingenieros),
      marca_nombre: uno(marcas),
      _tipoContrato: tipoDe(contratos),
      // Calculado una sola vez por fila — lo usa el sort de abajo Y se
      // expone en `OrdenListada` para pintar la insignia de SLA en la UI
      // (`badgeSla`), en vez de descartarlo como antes.
      horas_sla: horasParaVencerSla(orden.origen, orden.datos_especificos, orden.creado_en, ahora),
    }))
    .sort((a, b) => {
      const pa = prioridadDe(a.estatus);
      const pb = prioridadDe(b.estatus);
      if (pa !== pb) return pa - pb;

      const sa = prioridadServicio(a.origen, a.marca_nombre, a._tipoContrato);
      const sb = prioridadServicio(b.origen, b.marca_nombre, b._tipoContrato);
      if (sa !== sb) return sa - sb;

      // Desempate por urgencia de SLA: null (no aplica o falta el dato) no
      // debe moverse — se queda donde ya lo puso `prioridadServicio`, así
      // que ordena después de cualquier orden con urgencia real.
      const ua = a.horas_sla;
      const ub = b.horas_sla;
      if (ua !== ub) {
        if (ua === null) return 1;
        if (ub === null) return -1;
        return ua - ub;
      }

      const va = Number(a.numero_visita) || 1;
      const vb = Number(b.numero_visita) || 1;
      if (va !== vb) return va - vb;

      const fa = a.fecha_eta || "9999-12-31";
      const fb = b.fecha_eta || "9999-12-31";
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ _tipoContrato, datos_especificos, creado_en, ...orden }) => orden) as OrdenListada[];

  return { ordenes, error: null };
}
