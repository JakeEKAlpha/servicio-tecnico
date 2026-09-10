import type { SupabaseClient } from "@supabase/supabase-js";

/** Campos que la app de campo necesita de una orden. */
export const COLUMNAS_CAMPO =
  "id, numero_orden, numero_visita, origen, estatus, cliente, contacto, " +
  "tel_movil, tel_fijo, direccion, localidad, estado, modelo, serie, falla, " +
  "comentarios, fecha_eta, hora_eta, ingeniero_id, sucursal, sucursal_id, " +
  "link_doc, link_pdf, hora_inicio_real, hora_fin_real, lat_inicio, lng_inicio, " +
  "contador_mono, contador_color, diagnostico_campo, checklist, marca_id, zona_id";

export type OrdenCampo = {
  id: string;
  numero_orden: string;
  numero_visita: number | null;
  origen: string | null;
  estatus: string | null;
  cliente: string | null;
  contacto: string | null;
  tel_movil: string | null;
  tel_fijo: string | null;
  direccion: string | null;
  localidad: string | null;
  estado: string | null;
  modelo: string | null;
  serie: string | null;
  falla: string | null;
  comentarios: string | null;
  fecha_eta: string | null;
  hora_eta: string | null;
  ingeniero_id: string | null;
  sucursal: string | null;
  sucursal_id: string | null;
  link_doc: string | null;
  link_pdf: string | null;
  hora_inicio_real: string | null;
  hora_fin_real: string | null;
  lat_inicio: number | null;
  lng_inicio: number | null;
  contador_mono: number | null;
  contador_color: number | null;
  diagnostico_campo: string | null;
  checklist: Record<string, boolean> | null;
  marca_id: string | null;
  zona_id: string;
};

const CERRADAS = ["Concluido", "Cancelado"];

/**
 * Órdenes activas asignadas a un ingeniero, ordenadas por fecha y hora ETA.
 * RLS ya limita a la zona; esto filtra a las suyas.
 */
export async function ordenesDelIngeniero(
  supabase: SupabaseClient,
  ingenieroId: string,
): Promise<OrdenCampo[]> {
  const { data } = await supabase
    .from("ordenes")
    .select(COLUMNAS_CAMPO)
    .eq("ingeniero_id", ingenieroId)
    .not("estatus", "in", `(${CERRADAS.join(",")})`)
    .order("fecha_eta", { ascending: true, nullsFirst: false })
    .order("hora_eta", { ascending: true, nullsFirst: false });

  return (data ?? []) as unknown as OrdenCampo[];
}
