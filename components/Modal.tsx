"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Portal from "@/components/Portal";
import { overlay, panel } from "@/lib/ui";

const FOCUSABLES =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal accesible: se monta en <body> vía Portal (para que `position: fixed`
 * no quede atrapado por tarjetas animadas o contenedores con scroll), cierra
 * con Escape y clic en el fondo, bloquea el scroll del body, mueve el foco al
 * abrir, lo devuelve al cerrar y atrapa el Tab dentro.
 */
export default function Modal({
  onClose,
  titulo,
  children,
  ancho = "max-w-md",
  centrado = false,
}: {
  onClose: () => void;
  titulo: string;
  children: ReactNode;
  ancho?: string;
  centrado?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
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
  }, [onClose]);

  return (
    <Portal>
      <div
        className={overlay + (centrado ? " items-center" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          ref={ref}
          tabIndex={-1}
          className={panel + " " + ancho + " focus:outline-none"}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
