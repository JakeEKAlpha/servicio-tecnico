import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { empresaDeZona } from "@/lib/empresa";
import { leerPreferencias } from "@/lib/panel/datos";
import { IDS_OCULTABLES, type ColumnaTableroId } from "@/lib/ordenes/columnasTablero";
import Configuracion from "@/components/Configuracion";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { perfil } = await perfilActual();
  const empresa = empresaDeZona(perfil.zona_nombre);

  const prefs = await leerPreferencias(supabase, ["tablero_columnas_ocultas"]);
  const columnasOcultasIniciales = (
    Array.isArray(prefs.tablero_columnas_ocultas) ? prefs.tablero_columnas_ocultas : []
  ).filter((id): id is ColumnaTableroId =>
    (IDS_OCULTABLES as string[]).includes(String(id)),
  );

  return (
    <Configuracion
      nombre={perfil.nombre}
      rol={perfil.rol}
      zona={perfil.zona_nombre}
      empresa={empresa.nombre}
      columnasOcultasIniciales={columnasOcultasIniciales}
    />
  );
}
