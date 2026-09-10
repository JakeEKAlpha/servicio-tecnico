import { perfilActual } from "@/lib/auth/sesion";
import { empresaDeZona } from "@/lib/empresa";
import Configuracion from "@/components/Configuracion";

export default async function ConfiguracionPage() {
  const { perfil } = await perfilActual();
  const empresa = empresaDeZona(perfil.zona_nombre);

  return (
    <Configuracion
      nombre={perfil.nombre}
      rol={perfil.rol}
      zona={perfil.zona_nombre}
      empresa={empresa.nombre}
    />
  );
}
