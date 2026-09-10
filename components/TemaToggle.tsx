"use client";

import { useEffect, useLayoutEffect, useState } from "react";

type Tema = "sistema" | "claro" | "oscuro";

function aplicar(t: Tema) {
  const el = document.documentElement;
  if (t === "sistema") {
    delete el.dataset.theme;
    try {
      localStorage.removeItem("tema");
    } catch {
      /* noop */
    }
  } else {
    el.dataset.theme = t === "oscuro" ? "dark" : "light";
    try {
      localStorage.setItem("tema", el.dataset.theme);
    } catch {
      /* noop */
    }
  }
}

const OPCIONES: { v: Tema; label: string }[] = [
  { v: "sistema", label: "Sistema" },
  { v: "claro", label: "Claro" },
  { v: "oscuro", label: "Oscuro" },
];

export default function TemaToggle() {
  const [tema, setTema] = useState<Tema>("sistema");

  // Reaplica el atributo que el remount de Strict Mode borra en desarrollo
  // (no-op en producción).
  useLayoutEffect(() => {
    let t: string | null = null;
    try {
      t = localStorage.getItem("tema");
    } catch {
      /* noop */
    }
    if (t === "dark" || t === "light") {
      document.documentElement.dataset.theme = t;
    }
  }, []);

  useEffect(() => {
    let t: string | null = null;
    try {
      t = localStorage.getItem("tema");
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTema(t === "dark" ? "oscuro" : t === "light" ? "claro" : "sistema");
  }, []);

  return (
    <div className="px-4 py-2.5">
      <p className="mb-1.5 text-xs font-semibold text-muted">Tema</p>
      <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5">
        {OPCIONES.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => {
              setTema(o.v);
              aplicar(o.v);
            }}
            className={
              "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors " +
              (tema === o.v
                ? "bg-surface text-text shadow-sm"
                : "text-muted hover:text-text")
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
