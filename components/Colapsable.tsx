"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Tarjeta que se abre y cierra al hacer clic en su cabecera. Recuerda el
 * estado (abierto/cerrado) por `id` en localStorage.
 */
export default function Colapsable({
  id,
  titulo,
  icono,
  resumen,
  accion,
  defaultAbierto = true,
  children,
}: {
  id: string;
  titulo: string;
  icono?: ReactNode;
  /** Texto corto visible cuando está cerrado (ej. "3 piezas"). */
  resumen?: ReactNode;
  /** Elemento a la derecha de la cabecera (ej. un chip de estado). */
  accion?: ReactNode;
  defaultAbierto?: boolean;
  children: ReactNode;
}) {
  const clave = "colap:" + id;
  const [abierto, setAbierto] = useState(defaultAbierto);

  useEffect(() => {
    let v: string | null = null;
    try {
      v = localStorage.getItem(clave);
    } catch {
      /* noop */
    }
    if (v === "0" || v === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAbierto(v === "1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alternar() {
    setAbierto((a) => {
      const nuevo = !a;
      try {
        localStorage.setItem(clave, nuevo ? "1" : "0");
      } catch {
        /* noop */
      }
      return nuevo;
    });
  }

  const panelId = "colap-panel-" + id;

  return (
    <section className="overflow-hidden rounded-xl border border-border-default bg-surface shadow-sm transition-colors duration-200 hover:border-brand/25">
      <h2 className="m-0">
        <button
          type="button"
          onClick={alternar}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60"
          aria-expanded={abierto}
          aria-controls={panelId}
        >
          {icono && (
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-050 text-brand"
            >
              {icono}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-text">{titulo}</span>
            {!abierto && resumen && (
              <span className="block truncate text-xs font-normal text-muted">
                {resumen}
              </span>
            )}
          </span>
          {accion}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={
              "h-4 w-4 shrink-0 text-muted transition-transform duration-200 ease-out " +
              (abierto ? "rotate-180" : "")
            }
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.4a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </h2>
      {abierto && (
        <div
          id={panelId}
          className="anim-collapse border-t border-border-default px-4 py-4"
        >
          {children}
        </div>
      )}
    </section>
  );
}
