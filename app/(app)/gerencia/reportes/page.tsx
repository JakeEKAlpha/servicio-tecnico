import { createClient } from "@/lib/supabase/server";
import { cargarOpcionesFiltro, cargarOrdenesAnalitica, type FiltrosReportes } from "@/lib/reportes/datos";
import {
  calcularKpis,
  porEstatus,
  porIngeniero,
  porTipoServicio,
  tendenciaSemanal,
  vencidasAbiertas,
} from "@/lib/reportes/analitica";
import ReportesClient from "@/components/gerencia/reportes/ReportesClient";

export const dynamic = "force-dynamic";

type Params = {
  desde?: string;
  hasta?: string;
  zona?: string;
  sucursal?: string;
  marca?: string;
  ingeniero?: string;
  origen?: string;
  estatus?: string;
};

/**
 * Análisis de servicios — gerencia. El acceso ya está gateado por
 * `app/(app)/gerencia/layout.tsx` (solo gerencia/admin). Adaptado del
 * dashboard ejecutivo de referencia que compartió el usuario, ver la nota
 * al inicio de `lib/reportes/analitica.ts`.
 */
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const filtros: FiltrosReportes = {
    desde: sp.desde || undefined,
    hasta: sp.hasta || undefined,
    zonaId: sp.zona || undefined,
    sucursalId: sp.sucursal || undefined,
    marcaId: sp.marca || undefined,
    ingenieroId: sp.ingeniero || undefined,
    origen: sp.origen || undefined,
    estatus: sp.estatus || undefined,
  };

  const supabase = await createClient();
  const [{ ordenes, error }, opciones] = await Promise.all([
    cargarOrdenesAnalitica(supabase, filtros),
    cargarOpcionesFiltro(supabase),
  ]);

  const ahora = new Date();

  return (
    <ReportesClient
      ordenes={ordenes}
      error={error}
      opciones={opciones}
      kpis={calcularKpis(ordenes, ahora)}
      estatus={porEstatus(ordenes)}
      tipoServicio={porTipoServicio(ordenes)}
      ingenieros={porIngeniero(ordenes, ahora)}
      tendencia={tendenciaSemanal(ordenes, ahora)}
      vencidas={vencidasAbiertas(ordenes, ahora)}
      filtros={{
        desde: sp.desde ?? "",
        hasta: sp.hasta ?? "",
        zona: sp.zona ?? "",
        sucursal: sp.sucursal ?? "",
        marca: sp.marca ?? "",
        ingeniero: sp.ingeniero ?? "",
        origen: sp.origen ?? "",
        estatus: sp.estatus ?? "",
      }}
    />
  );
}
