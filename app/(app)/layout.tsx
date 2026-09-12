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

  // Los ingenieros usan la versión de campo, no el panel de coordinación.
  if (perfil.rol === "ingeniero") {
    redirect("/campo");
  }

  // Almacén usa su propia pantalla — no el Tablero completo (no es su
  // función asignar órdenes ni ver todo lo que ve un coordinador). Bug real
  // encontrado en producción 2026-09-12: faltaba este redirect, así que
  // cualquier cuenta con rol `almacen` caía en /tablero con los mismos
  // poderes que un coordinador.
  if (perfil.rol === "almacen") {
    redirect("/almacen");
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
