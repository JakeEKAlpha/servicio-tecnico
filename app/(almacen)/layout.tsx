import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { cerrarSesion } from "@/app/login/acciones";
import { empresaDeZona } from "@/lib/empresa";
import AppShell from "@/components/AppShell";

/**
 * Grupo de rutas propio para `/almacen` — igual que `(campo)` para
 * `/campo`. Necesario para que el redirect `almacen -> /almacen` de
 * `(app)/layout.tsx` no caiga en loop consigo mismo: ese redirect solo
 * dispara cuando alguien con rol `almacen` visita una ruta de `(app)`
 * (/tablero, /gerencia, …); como `/almacen` ya no es una de esas rutas,
 * nunca se vuelve a evaluar esa condición.
 *
 * Bug real en producción (2026-09-12): `/almacen` vivía dentro de `(app)`,
 * así que el mismo redirect se disparaba sobre sí mismo sin parar
 * (pantalla parpadeando) en cuanto se agregó — encontrado por el primer
 * usuario real de rol `almacen`.
 *
 * No se restringe por rol aquí: coordinador y gerencia también entran a
 * `/almacen` en modo solo-lectura (ver `AlmacenPage`), es la propia página
 * la que decide editar/ver según el rol.
 */
export default async function AlmacenLayout({
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
