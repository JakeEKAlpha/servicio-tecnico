import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { etiquetaRol } from "@/lib/auth/roles";
import { resumenInicio } from "@/lib/inicio/datos";
import Dashboard from "@/components/inicio/Dashboard";

export default async function InicioPage() {
  const supabase = await createClient();
  const { perfil } = await perfilActual();
  const resumen = await resumenInicio(supabase, perfil);

  return (
    <Dashboard
      nombre={perfil.nombre}
      rolEtiqueta={etiquetaRol(perfil.rol)}
      resumen={resumen}
    />
  );
}
