import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { cerrarSesion } from "@/app/login/acciones";
import { empresaDeZona } from "@/lib/empresa";
import AppShell from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { perfil } = await perfilActual();

  if (perfil.debe_cambiar_password) {
    redirect("/actualizar-password");
  }

  const empresa = empresaDeZona(perfil.zona_nombre);

  return (
    <AppShell
      empresaClave={empresa.clave}
      empresaNombre={empresa.nombre}
      empresaLema={empresa.lema}
      esGerencia={esRolQueVeTodo(perfil.rol)}
      zonaNombre={perfil.zona_nombre}
      userNombre={perfil.nombre}
      userRol={perfil.rol}
      cerrarSesion={cerrarSesion}
    >
      {children}
    </AppShell>
  );
}
