import Link from "next/link";
import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { RECURSOS } from "@/lib/gerencia/recursos";

const TABS = Object.entries(RECURSOS).map(([k, v]) => ({
  href: `/gerencia/${k}`,
  label: v.titulo,
}));

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
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-brand">
        Panel de Gerencia
      </h1>
      <p className="mb-4 text-sm text-muted">
        Configuración de ingenieros, zonas, sucursales y contactos.
      </p>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-border-default">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-t-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
