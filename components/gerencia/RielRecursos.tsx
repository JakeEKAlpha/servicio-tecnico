"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GRUPOS_RECURSOS, RECURSOS } from "@/lib/gerencia/recursos";

/**
 * Riel de recursos agrupado (Personas / Lugares / Cuentas Lexmark) en vez de
 * 8 pestañas en una fila — wireframe 11p.
 */
export default function RielRecursos() {
  const pathname = usePathname();

  return (
    <nav className="w-full shrink-0 space-y-4 md:w-48">
      <div>
        <Link
          href="/gerencia/reportes"
          className={
            "block rounded-lg px-2 py-1.5 text-sm font-bold transition-colors " +
            (pathname === "/gerencia/reportes"
              ? "bg-brand-050 text-brand"
              : "text-text hover:bg-surface-2 hover:text-brand")
          }
        >
          📊 Reportes
        </Link>
      </div>
      {GRUPOS_RECURSOS.map((g) => (
        <div key={g.titulo}>
          <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wide text-muted">
            {g.titulo}
          </p>
          <ul className="space-y-0.5">
            {g.recursos.map((k) => {
              const cfg = RECURSOS[k];
              if (!cfg) return null;
              const href = `/gerencia/${k}`;
              const activo = pathname === href;
              return (
                <li key={k}>
                  <Link
                    href={href}
                    className={
                      "block rounded-lg px-2 py-1.5 text-sm font-medium transition-colors " +
                      (activo
                        ? "bg-brand-050 font-semibold text-brand"
                        : "text-muted hover:bg-surface-2 hover:text-text")
                    }
                  >
                    {cfg.titulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
