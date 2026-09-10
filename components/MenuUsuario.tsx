"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TemaToggle from "@/components/TemaToggle";
import { etiquetaRol } from "@/lib/auth/roles";

export default function MenuUsuario({
  nombre,
  rol,
  empresa,
  cerrarSesion,
}: {
  nombre: string;
  rol: string;
  empresa: string;
  cerrarSesion: () => void | Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const iniciales = nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm text-text transition-colors hover:bg-surface-2"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
          {iniciales}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[9rem] truncate font-semibold">
            {nombre}
          </span>
          <span className="block text-[11px] text-muted">
            {etiquetaRol(rol)}
          </span>
        </span>
        <svg
          viewBox="0 0 20 20"
          className={
            "h-4 w-4 text-muted transition-transform " +
            (abierto ? "rotate-180" : "")
          }
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.4a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {abierto && (
        <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border-default bg-surface text-text shadow-2xl">
          <div className="border-b border-border-default px-4 py-3">
            <p className="text-sm font-semibold">{nombre}</p>
            <p className="text-xs text-muted">
              {etiquetaRol(rol)} · {empresa}
            </p>
          </div>
          <TemaToggle />
          <Link
            href="/actualizar-password"
            onClick={() => setAbierto(false)}
            className="block border-t border-border-default px-4 py-2.5 text-sm hover:bg-surface-2"
          >
            Cambiar contraseña
          </Link>
          <form action={cerrarSesion} className="border-t border-border-default">
            <button
              type="submit"
              className="block w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-surface-2"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
