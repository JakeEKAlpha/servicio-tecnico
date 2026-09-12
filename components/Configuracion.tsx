"use client";

import { useLayoutEffect, useEffect, useState } from "react";
import Link from "next/link";
import { tarjeta, encabezadoSeccion, enlace, chip } from "@/lib/ui";
import { etiquetaRol } from "@/lib/auth/roles";
import { claseEstatus } from "@/lib/tema";
import { COLUMNAS_TABLERO, type ColumnaTableroId } from "@/lib/ordenes/columnasTablero";

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
            "rounded-md px-3 py-1.5 text-[12px] font-extrabold transition-colors " +
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
          <tr className="border-b border-border-default bg-surface-2 text-left text-[10px] font-extrabold uppercase tracking-wide text-muted">
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

/** Columnas de la tabla del Tablero que el usuario decide mostrar/ocultar.
 *  Se guarda en el servidor (preferencias_usuario), no en este dispositivo
 *  — a diferencia de Tema/Densidad de arriba, viaja con la cuenta. */
function ColumnasTablero({ inicial }: { inicial: ColumnaTableroId[] }) {
  const [ocultas, setOcultas] = useState<Set<ColumnaTableroId>>(() => new Set(inicial));
  const [guardando, setGuardando] = useState<ColumnaTableroId | null>(null);

  function alternar(id: ColumnaTableroId) {
    const next = new Set(ocultas);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOcultas(next);
    setGuardando(id);
    fetch("/api/preferencias", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clave: "tablero_columnas_ocultas", valor: [...next] }),
    })
      .catch(() => undefined)
      .finally(() => setGuardando((g) => (g === id ? null : g)));
  }

  const columnas = COLUMNAS_TABLERO.filter((c) => !c.fijo);

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">Columnas de la tabla</p>
      <p className="mb-2 text-xs text-muted">
        Número, Cliente y Estatus siempre se muestran. El ancho de cada
        columna se ajusta arrastrando su borde en el Tablero.
      </p>
      <div className="flex flex-wrap gap-2">
        {columnas.map((c) => {
          const visible = !ocultas.has(c.id);
          return (
            <label
              key={c.id}
              className={
                "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors " +
                (visible
                  ? "border-brand/30 bg-brand-050 text-brand"
                  : "border-border-default text-muted hover:text-text")
              }
            >
              <input
                type="checkbox"
                checked={visible}
                onChange={() => alternar(c.id)}
                disabled={guardando === c.id}
                className="accent-brand"
              />
              {c.etiqueta}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function Configuracion({
  nombre,
  rol,
  zona,
  empresa,
  columnasOcultasIniciales,
}: {
  nombre: string;
  rol: string;
  zona: string | null;
  empresa: string;
  columnasOcultasIniciales: ColumnaTableroId[];
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
        <h1 className="text-[18px] font-extrabold tracking-tight text-brand">
          Configuración
        </h1>
        <p className="text-sm text-muted">
          La mayoría de tus preferencias se guardan solo en este dispositivo
          — el Tablero es la excepción, viaja con tu cuenta (ver abajo).
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
        <h2 className={encabezadoSeccion}>Tablero</h2>
        <p className="mb-3 text-sm text-muted">
          Esta preferencia se guarda en tu cuenta: te acompaña en cualquier
          sesión o dispositivo donde inicies sesión.
        </p>
        <ColumnasTablero inicial={columnasOcultasIniciales} />
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
