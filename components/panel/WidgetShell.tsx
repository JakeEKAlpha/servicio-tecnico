"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Marco común de cada widget del panel: cabecera con título y, en modo edición,
 * un menú (⋯) para quitarlo o cambiarle el tamaño. La cabecera es el "asa" de
 * arrastre (clase `arrastrar`, que `Panel` pasa como `draggableHandle`).
 */
export default function WidgetShell({
  titulo,
  editando,
  onQuitar,
  onTamano,
  children,
}: {
  titulo: string;
  editando: boolean;
  onQuitar: () => void;
  onTamano: (t: "s" | "m" | "l") => void;
  children: React.ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [menu]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border-default bg-surface shadow-sm">
      <div
        className={
          "flex items-center justify-between gap-2 border-b border-border-default px-3 py-2 " +
          (editando ? "arrastrar cursor-move select-none" : "")
        }
      >
        <span className="truncate text-xs font-bold text-text">{titulo}</span>

        {editando && (
          <div className="relative" ref={ref}>
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text"
              aria-label={`Opciones de ${titulo}`}
              aria-haspopup="menu"
              aria-expanded={menu}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <circle cx="5" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="19" cy="12" r="1.6" />
              </svg>
            </button>

            {menu && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-border-default bg-surface py-1 text-xs shadow-lg"
              >
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                  Tamaño
                </div>
                {(["s", "m", "l"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onTamano(t);
                      setMenu(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left font-semibold text-text hover:bg-surface-2"
                  >
                    {t === "s" ? "Chico" : t === "m" ? "Mediano" : "Grande"}
                  </button>
                ))}
                <div className="my-1 border-t border-border-default" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onQuitar();
                    setMenu(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left font-semibold text-red hover:bg-surface-2"
                >
                  Quitar del panel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="scroll-oculto min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </div>
  );
}
