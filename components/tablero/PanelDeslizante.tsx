"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Portal from "@/components/Portal";
import { Cerrar } from "@/lib/iconos";

const FOCUSABLES =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Panel lateral de detalle del tablero — pantalla 1 del wireframe (11a):
 * "el panel de detalle incluye piezas... sin salir del tablero". Se abre al
 * interceptar `/tablero/[ordenId]` (ver `@panel/(.)[ordenId]`); `router.back()`
 * lo cierra y regresa la URL a `/tablero`, con lo cual el link es compartible
 * (recarga = página completa, no panel).
 */
export default function PanelDeslizante({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  function cerrar() {
    router.back();
  }

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        cerrar();
        return;
      }
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>(FOCUSABLES);
        if (f.length === 0) return;
        const primero = f[0];
        const ultimo = f[f.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previo?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Portal>
      <div
        className="anim-modal-backdrop fixed inset-0 z-50 bg-brand/20 backdrop-blur-[1px]"
        onMouseDown={(e) => e.target === e.currentTarget && cerrar()}
      >
        <div
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className="anim-panel absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col border-l border-border-default bg-bg shadow-2xl focus:outline-none"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-default bg-surface px-4 py-3">
            <span className="truncate text-sm font-bold text-text">
              {titulo}
            </span>
            <button
              type="button"
              onClick={cerrar}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
              aria-label="Cerrar panel"
            >
              <Cerrar className="h-4 w-4" />
            </button>
          </div>
          <div className="scroll-oculto min-h-0 flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </div>
    </Portal>
  );
}
