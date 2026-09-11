import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import RielRecursos from "@/components/gerencia/RielRecursos";

export default async function GerenciaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { perfil } = await perfilActual();
  if (!esRolQueVeTodo(perfil.rol)) {
    redirect("/tablero");
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-[18px] font-extrabold tracking-tight text-brand">
        Panel de Gerencia
      </h1>
      <p className="mb-6 text-sm text-muted">
        Configuración de ingenieros, zonas, sucursales y contactos.
      </p>
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <RielRecursos />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
