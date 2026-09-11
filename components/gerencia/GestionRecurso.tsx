"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Campo, RecursoConfig } from "@/lib/gerencia/recursos";
import { boton, botonSec, campo, tarjeta, etiqueta } from "@/lib/ui";
import { Editar } from "@/lib/iconos";
import PanelDeslizante from "@/components/tablero/PanelDeslizante";

export type Opcion = { value: string; label: string };
type Fila = Record<string, unknown> & { id: string };
type EstadoPanel = { modo: "crear" } | { modo: "editar"; fila: Fila } | null;

function valorTexto(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function CeldaEdit({
  campoDef,
  valor,
  onChange,
  opciones,
}: {
  campoDef: Campo;
  valor: unknown;
  onChange: (v: unknown) => void;
  opciones: Record<string, Opcion[]>;
}) {
  if (campoDef.tipo === "bool") {
    return (
      <input
        type="checkbox"
        checked={!!valor}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    );
  }
  if (campoDef.tipo === "select") {
    const lista = opciones[campoDef.opciones ?? ""] ?? [];
    return (
      <select
        value={valorTexto(valor)}
        onChange={(e) => onChange(e.target.value || null)}
        className={campo}
      >
        <option value="">—</option>
        {lista.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (campoDef.tipo === "area") {
    return (
      <textarea
        rows={3}
        value={valorTexto(valor)}
        onChange={(e) => onChange(e.target.value)}
        className={campo}
      />
    );
  }
  return (
    <input
      type={campoDef.tipo === "num" ? "number" : "text"}
      value={valorTexto(valor)}
      onChange={(e) =>
        onChange(
          campoDef.tipo === "num"
            ? e.target.value === ""
              ? null
              : Number(e.target.value)
            : e.target.value,
        )
      }
      className={campo}
    />
  );
}

export default function GestionRecurso({
  recurso,
  cfg,
  filas,
  opciones,
}: {
  recurso: string;
  cfg: RecursoConfig;
  filas: Fila[];
  opciones: Record<string, Opcion[]>;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<EstadoPanel>(null);
  const [borrador, setBorrador] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function etiquetaOpcion(campoDef: Campo, valor: unknown): string {
    if (campoDef.tipo === "bool") return valor ? "Sí" : "No";
    if (campoDef.tipo === "select") {
      const lista = opciones[campoDef.opciones ?? ""] ?? [];
      return lista.find((o) => o.value === valorTexto(valor))?.label || "—";
    }
    return valorTexto(valor) || "—";
  }

  function abrirCrear() {
    setBorrador({});
    setMsg(null);
    setPanel({ modo: "crear" });
  }

  function abrirEditar(f: Fila) {
    setBorrador(Object.fromEntries(cfg.campos.map((c) => [c.k, f[c.k] ?? null])));
    setMsg(null);
    setPanel({ modo: "editar", fila: f });
  }

  async function guardar() {
    if (!panel || panel.modo !== "editar") return;
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/gerencia/${recurso}/${panel.fila.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(borrador),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) setMsg(data.error ?? "No se pudo guardar.");
      else {
        setPanel(null);
        router.refresh();
      }
    } catch {
      setMsg("Error de red.");
    } finally {
      setOcupado(false);
    }
  }

  async function crear() {
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/gerencia/${recurso}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(borrador),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) setMsg(data.error ?? "No se pudo crear.");
      else {
        setPanel(null);
        router.refresh();
      }
    } catch {
      setMsg("Error de red.");
    } finally {
      setOcupado(false);
    }
  }

  async function borrar() {
    if (!panel || panel.modo !== "editar") return;
    if (!confirm("¿Borrar este registro?")) return;
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/gerencia/${recurso}/${panel.fila.id}`, {
        method: "DELETE",
      });
      const data = await r.json();
      if (!r.ok || !data.ok) setMsg(data.error ?? "No se pudo borrar.");
      else {
        setPanel(null);
        router.refresh();
      }
    } catch {
      setMsg("Error de red.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-brand">{cfg.titulo}</h2>
        {!cfg.soloEditar && (
          <button type="button" className={boton} onClick={abrirCrear}>
            Agregar
          </button>
        )}
      </div>

      {/* La tabla es siempre de solo lectura — nunca cambia de forma;
          editar/crear vive en el panel lateral (wireframe 11p). */}
      <div className="scroll-oculto overflow-x-auto rounded-xl border border-border-default bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-2 text-left text-[10px] font-extrabold uppercase tracking-wide text-muted">
              {cfg.campos.map((c) => (
                <th key={c.k} className="px-3 py-2.5">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.id}
                className="cursor-pointer border-b border-border-default/70 align-top transition-colors hover:bg-brand-050"
                onClick={() => abrirEditar(f)}
              >
                {cfg.campos.map((c) => (
                  <td key={c.k} className="px-3 py-2">
                    <span
                      className={
                        c.tipo === "area" ? "line-clamp-2 max-w-xs text-muted" : ""
                      }
                    >
                      {etiquetaOpcion(c, f[c.k])}
                    </span>
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-brand"
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEditar(f);
                    }}
                    aria-label={`Editar ${cfg.titulo.toLowerCase()}`}
                    title="Editar"
                  >
                    <Editar className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td
                  colSpan={cfg.campos.length + 1}
                  className="px-3 py-6 text-center text-sm text-muted"
                >
                  Sin registros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {panel && (
        <PanelDeslizante
          titulo={panel.modo === "crear" ? `Agregar · ${cfg.titulo}` : `Editar · ${cfg.titulo}`}
          onCerrar={() => setPanel(null)}
        >
          <div className="space-y-4">
            {msg && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {msg}
              </p>
            )}
            <div className={tarjeta + " space-y-3"}>
              {cfg.campos.map((c) => (
                <label key={c.k} className="block text-sm">
                  <span className={etiqueta}>
                    {c.label}
                    {c.requerido && " *"}
                  </span>
                  <div>
                    <CeldaEdit
                      campoDef={c}
                      valor={borrador[c.k]}
                      opciones={opciones}
                      onChange={(v) => setBorrador((p) => ({ ...p, [c.k]: v }))}
                    />
                  </div>
                  {c.ayuda && (
                    <span className="mt-1 block text-xs font-normal text-muted">
                      {c.ayuda}
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              {panel.modo === "editar" && !cfg.soloEditar ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-danger hover:underline"
                  onClick={borrar}
                  disabled={ocupado}
                >
                  Borrar
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className={botonSec}
                  onClick={() => setPanel(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={boton}
                  disabled={ocupado}
                  onClick={panel.modo === "crear" ? crear : guardar}
                >
                  {panel.modo === "crear" ? "Crear" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </PanelDeslizante>
      )}
    </div>
  );
}
