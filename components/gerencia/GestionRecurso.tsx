"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Campo, RecursoConfig } from "@/lib/gerencia/recursos";
import { boton, botonSec, botonTexto, campo, tarjeta } from "@/lib/ui";

export type Opcion = { value: string; label: string };
type Fila = Record<string, unknown> & { id: string };

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
        rows={2}
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
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Record<string, unknown>>({});
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState<Record<string, unknown>>({});
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

  async function guardar(id: string) {
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/gerencia/${recurso}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(borrador),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) setMsg(data.error ?? "No se pudo guardar.");
      else {
        setEditando(null);
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
        body: JSON.stringify(nuevo),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) setMsg(data.error ?? "No se pudo crear.");
      else {
        setCreando(false);
        setNuevo({});
        router.refresh();
      }
    } catch {
      setMsg("Error de red.");
    } finally {
      setOcupado(false);
    }
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar este registro?")) return;
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/gerencia/${recurso}/${id}`, {
        method: "DELETE",
      });
      const data = await r.json();
      if (!r.ok || !data.ok) setMsg(data.error ?? "No se pudo borrar.");
      else router.refresh();
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
          <button
            type="button"
            className={boton}
            onClick={() => {
              setCreando((v) => !v);
              setNuevo({});
            }}
          >
            {creando ? "Cerrar" : "Agregar"}
          </button>
        )}
      </div>

      {msg && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {msg}
        </p>
      )}

      {creando && (
        <div className={tarjeta + " space-y-3"}>
          <div className="grid gap-3 sm:grid-cols-2">
            {cfg.campos.map((c) => (
              <label key={c.k} className="text-sm">
                {c.label}
                {c.requerido && " *"}
                <CeldaEdit
                  campoDef={c}
                  valor={nuevo[c.k]}
                  opciones={opciones}
                  onChange={(v) => setNuevo((p) => ({ ...p, [c.k]: v }))}
                />
                {c.ayuda && (
                  <span className="mt-0.5 block text-xs text-muted">
                    {c.ayuda}
                  </span>
                )}
              </label>
            ))}
          </div>
          <button
            type="button"
            className={boton}
            disabled={ocupado}
            onClick={crear}
          >
            Crear
          </button>
        </div>
      )}

      <div className="scroll-oculto overflow-x-auto rounded-xl border border-border-default bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              {cfg.campos.map((c) => (
                <th key={c.k} className="px-3 py-2.5">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const enEdicion = editando === f.id;
              return (
                <tr
                  key={f.id}
                  className="border-b border-border-default/70 align-top"
                >
                  {cfg.campos.map((c) => (
                    <td key={c.k} className="px-3 py-2">
                      {enEdicion ? (
                        <CeldaEdit
                          campoDef={c}
                          valor={borrador[c.k]}
                          opciones={opciones}
                          onChange={(v) =>
                            setBorrador((p) => ({ ...p, [c.k]: v }))
                          }
                        />
                      ) : (
                        <span
                          className={
                            c.tipo === "area"
                              ? "line-clamp-2 max-w-xs text-muted"
                              : ""
                          }
                        >
                          {etiquetaOpcion(c, f[c.k])}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {enEdicion ? (
                      <span className="flex justify-end gap-2">
                        <button
                          type="button"
                          className={botonSec}
                          onClick={() => setEditando(null)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className={boton}
                          disabled={ocupado}
                          onClick={() => guardar(f.id)}
                        >
                          Guardar
                        </button>
                      </span>
                    ) : (
                      <span className="flex justify-end gap-3">
                        <button
                          type="button"
                          className={botonTexto}
                          onClick={() => {
                            setEditando(f.id);
                            setBorrador(
                              Object.fromEntries(
                                cfg.campos.map((c) => [c.k, f[c.k] ?? null]),
                              ),
                            );
                          }}
                        >
                          Editar
                        </button>
                        {!cfg.soloEditar && (
                          <button
                            type="button"
                            className="text-xs font-semibold text-danger hover:underline"
                            onClick={() => borrar(f.id)}
                          >
                            Borrar
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
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
    </div>
  );
}
