"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { tarjeta, encabezadoSeccion, enlace, chip } from "@/lib/ui";
import { etiquetaRol } from "@/lib/auth/roles";
import { claseEstatus } from "@/lib/tema";

type Tema = "sistema" | "claro" | "oscuro";
type Densidad = "comoda" | "compacta";

function aplicarTema(t: Tema) {
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

function aplicarDensidad(d: Densidad) {
  const el = document.documentElement;
  if (d === "compacta") el.dataset.densidad = "compacta";
  else delete el.dataset.densidad;
  try {
    localStorage.setItem("densidad", d);
  } catch {
    /* noop */
  }
}

function Segmento<T extends string>({
  valor,
  opciones,
  onCambio,
}: {
  valor: T;
  opciones: { v: T; label: string }[];
  onCambio: (v: T) => void;
}) {
  return (
    <div className="inline-flex gap-1 rounded-lg bg-surface-2 p-1">
      {opciones.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onCambio(o.v)}
          className={
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
            (valor === o.v
              ? "bg-surface text-text shadow-sm"
              : "text-muted hover:text-text")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const FILAS_PREVIA = [
  { orden: "40X7743", cliente: "AUTOZONE MÉXICO", estatus: "Asignado" },
  { orden: "12191300", cliente: "BBVA Bancomer", estatus: "Pendiente por partes" },
  { orden: "12218288", cliente: "Ganaderos Leche Pura", estatus: "Lista para realizar" },
] as const;

/** Miniatura de una tabla real: el efecto de tema/densidad se ve antes de
 * entrar al tablero (wireframe 10b). */
function VistaPreviaTabla({ densidad }: { densidad: Densidad }) {
  const py = densidad === "compacta" ? "py-1" : "py-2.5";
  return (
    <div className="overflow-hidden rounded-lg border border-border-default bg-surface">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border-default bg-surface-2 text-left font-semibold uppercase tracking-wide text-muted">
            <th className={"px-3 " + py}>Orden</th>
            <th className={"px-3 " + py}>Cliente</th>
            <th className={"px-3 " + py}>Estatus</th>
          </tr>
        </thead>
        <tbody>
          {FILAS_PREVIA.map((f) => (
            <tr key={f.orden} className="border-b border-border-default/70 last:border-0">
              <td className={"px-3 font-mono text-[11px] font-semibold text-text " + py}>
                {f.orden}
              </td>
              <td className={"px-3 text-text " + py}>{f.cliente}</td>
              <td className={"px-3 " + py}>
                <span className={chip + " " + claseEstatus(f.estatus)}>{f.estatus}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Configuracion({
  nombre,
  rol,
  zona,
  empresa,
}: {
  nombre: string;
  rol: string;
  zona: string | null;
  empresa: string;
}) {
  const [tema, setTema] = useState<Tema>("sistema");
  const [densidad, setDensidad] = useState<Densidad>("comoda");

  useLayoutEffect(() => {
    // reaplica lo guardado (por si Strict Mode lo limpió en dev)
    try {
      const d = localStorage.getItem("densidad");
      if (d === "compacta") document.documentElement.dataset.densidad = "compacta";
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      const t = localStorage.getItem("tema");
      const d = localStorage.getItem("densidad");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTema(t === "dark" ? "oscuro" : t === "light" ? "claro" : "sistema");
      if (d === "compacta") setDensidad("compacta");
    } catch {
      /* noop */
    }
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand">
          Configuración
        </h1>
        <p className="text-sm text-muted">
          Tus preferencias se guardan solo en este dispositivo.
        </p>
      </div>

      <div className={tarjeta}>
        <h2 className={encabezadoSeccion}>Apariencia</h2>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">Tema</p>
            <Segmento
              valor={tema}
              opciones={[
                { v: "sistema", label: "Sistema" },
                { v: "claro", label: "Claro" },
                { v: "oscuro", label: "Oscuro" },
              ]}
              onCambio={(v) => {
                setTema(v);
                aplicarTema(v);
              }}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Densidad de las tablas</p>
            <Segmento
              valor={densidad}
              opciones={[
                { v: "comoda", label: "Cómoda" },
                { v: "compacta", label: "Compacta" },
              ]}
              onCambio={(v) => {
                setDensidad(v);
                aplicarDensidad(v);
              }}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Vista previa</p>
            <VistaPreviaTabla densidad={densidad} />
          </div>
        </div>
      </div>

      <div className={tarjeta}>
        <h2 className={encabezadoSeccion}>Mi cuenta</h2>
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-muted">Nombre</dt>
          <dd className="font-medium">{nombre}</dd>
          <dt className="text-muted">Rol</dt>
          <dd className="font-medium">{etiquetaRol(rol)}</dd>
          <dt className="text-muted">Zona</dt>
          <dd className="font-medium">{zona ?? "—"}</dd>
          <dt className="text-muted">Empresa</dt>
          <dd className="font-medium">{empresa}</dd>
        </dl>
        <Link href="/actualizar-password" className={enlace + " mt-3 inline-block text-sm"}>
          Cambiar mi contraseña
        </Link>
      </div>
    </div>
  );
}
