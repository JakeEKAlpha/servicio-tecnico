import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { cerrarSesion } from "@/app/login/acciones";
import IconoAD from "@/components/IconoAD";
import ActivarNotificaciones from "@/components/campo/ActivarNotificaciones";

/**
 * Shell de la versión de ingeniería (`/campo`).
 * Móvil primero, sin barra lateral, identidad verde Lexmark.
 * Solo entran ingenieros; gerencia/admin puede ver para dar soporte.
 */
export default async function CampoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { perfil } = await perfilActual();

  if (perfil.debe_cambiar_password) redirect("/actualizar-password");

  const esIngeniero = perfil.rol === "ingeniero";
  if (!esIngeniero && !esRolQueVeTodo(perfil.rol)) {
    redirect("/tablero");
  }

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <header className="sticky top-0 z-30 bg-[#004B25] text-white shadow-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <IconoAD className="h-7 w-auto shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-extrabold">Servicio en sitio</p>
              <p className="truncate text-[11px] font-semibold uppercase tracking-widest text-emerald-200">
                {perfil.nombre}
              </p>
            </div>
          </div>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-100 ring-1 ring-white/20 transition-colors hover:bg-white/10"
            >
              Salir
            </button>
          </form>
        </div>
        {!esIngeniero && (
          <p className="bg-amber-500/90 px-4 py-1 text-center text-[11px] font-bold text-amber-950">
            Vista de ingeniero (modo soporte · {perfil.rol})
          </p>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {esIngeniero && <ActivarNotificaciones />}
        {children}
      </main>
    </div>
  );
}
