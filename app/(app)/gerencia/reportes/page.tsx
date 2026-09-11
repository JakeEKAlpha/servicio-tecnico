import { createClient } from "@/lib/supabase/server";
import { cargarOpcionesFiltro, cargarOrdenesAnalitica, type FiltrosReportes } from "@/lib/reportes/datos";
import { leerPreferencias } from "@/lib/panel/datos";
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

const CAMPOS_FILTRO = [
  "desde",
  "hasta",
  "zona",
  "sucursal",
  "marca",
  "ingeniero",
  "origen",
  "estatus",
] as const;
type CampoFiltro = (typeof CAMPOS_FILTRO)[number];
type Params = Partial<Record<CampoFiltro, string>> & { limpio?: string };

/**
 * Análisis de servicios — gerencia. El acceso ya está gateado por
 * `app/(app)/gerencia/layout.tsx` (solo gerencia/admin). Adaptado del
 * dashboard ejecutivo de referencia que compartió el usuario, ver la nota
 * al inicio de `lib/reportes/analitica.ts`.
 *
 * Personalización: recuerda los últimos filtros usados por el usuario
 * (`preferencias_usuario`, misma tabla del panel de `/inicio`) para que
 * volver a "Reportes" no arranque siempre en blanco. Una visita CON
 * filtros en la URL los guarda como los últimos usados; una visita SIN
 * ningún filtro los recupera — salvo que venga con `?limpio=1` (el link
 * "Limpiar"), que respeta la intención explícita de empezar sin filtros.
 */
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const hayFiltrosEnUrl = CAMPOS_FILTRO.some((c) => !!sp[c]);
  let efectivos: Partial<Record<CampoFiltro, string>> = sp;

  if (!hayFiltrosEnUrl && sp.limpio !== "1") {
    const prefs = await leerPreferencias(supabase, ["reportes_filtros"]);
    const guardados = prefs.reportes_filtros;
    if (guardados && typeof guardados === "object" && !Array.isArray(guardados)) {
      efectivos = guardados as Partial<Record<CampoFiltro, string>>;
    }
  } else if (hayFiltrosEnUrl) {
    // Fire-and-forget: no bloquea el render por guardar la preferencia.
    const plano: Partial<Record<CampoFiltro, string>> = {};
    for (const c of CAMPOS_FILTRO) if (sp[c]) plano[c] = sp[c];
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      void supabase
        .from("preferencias_usuario")
        .upsert(
          {
            user_id: user.id,
            clave: "reportes_filtros",
            valor: plano,
            actualizado_en: new Date().toISOString(),
          },
          { onConflict: "user_id,clave" },
        );
    });
  }

  const filtros: FiltrosReportes = {
    desde: efectivos.desde || undefined,
    hasta: efectivos.hasta || undefined,
    zonaId: efectivos.zona || undefined,
    sucursalId: efectivos.sucursal || undefined,
    marcaId: efectivos.marca || undefined,
    ingenieroId: efectivos.ingeniero || undefined,
    origen: efectivos.origen || undefined,
    estatus: efectivos.estatus || undefined,
  };

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
        desde: efectivos.desde ?? "",
        hasta: efectivos.hasta ?? "",
        zona: efectivos.zona ?? "",
        sucursal: efectivos.sucursal ?? "",
        marca: efectivos.marca ?? "",
        ingeniero: efectivos.ingeniero ?? "",
        origen: efectivos.origen ?? "",
        estatus: efectivos.estatus ?? "",
      }}
    />
  );
}
