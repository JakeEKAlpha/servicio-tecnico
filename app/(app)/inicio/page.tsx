import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { etiquetaRol } from "@/lib/auth/roles";
import { resumenInicio } from "@/lib/inicio/datos";
import { cargarDatosPanel, leerPreferencias } from "@/lib/panel/datos";
import { mergeLayout } from "@/lib/panel/layout";
import Dashboard from "@/components/inicio/Dashboard";
import Panel from "@/components/panel/Panel";
import ToggleVista from "@/components/panel/ToggleVista";

export default async function InicioPage() {
  const supabase = await createClient();
  const { perfil } = await perfilActual();

  const prefs = await leerPreferencias(supabase, ["inicio_vista", "panel_layout"]);

  // Vista simple: el dashboard de bienvenida de siempre, intacto.
  if (prefs.inicio_vista === "simple") {
    const resumen = await resumenInicio(supabase, perfil);
    return (
      <>
        <div className="mx-auto flex max-w-5xl justify-end px-6 pt-4">
          <ToggleVista actual="simple" />
        </div>
        <Dashboard
          nombre={perfil.nombre}
          rolEtiqueta={etiquetaRol(perfil.rol)}
          resumen={resumen}
        />
      </>
    );
  }

  // Vista panel (por defecto): widgets configurables.
  const datos = await cargarDatosPanel(supabase, perfil);
  const layout = mergeLayout(prefs.panel_layout, perfil.rol);

  return (
    <Panel
      datos={datos}
      rol={perfil.rol}
      contexto={`${etiquetaRol(perfil.rol)} · ${datos.base.contexto}`}
      nombre={perfil.nombre}
      layoutInicial={layout}
    />
  );
}
