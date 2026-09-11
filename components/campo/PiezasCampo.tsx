"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ETIQUETA_ESTADO_PIEZA, type PiezaOrden } from "@/lib/piezas";

const RE_NP = /^\d{2}X\d{4}$/;

/**
 * Piezas de la orden vistas desde campo.
 * - Pieza apartada / recibida  -> "Confirmar uso" (dispara el flujo de stock).
 * - Pieza apartada no usada     -> "No se usó" -> regresa a stock.
 * - "Anotar pieza usada"        -> queda como recomendada para que almacén /
 *   coordinación la concilien (no toca stock directamente).
 */
export default function PiezasCampo({
  ordenId,
  piezas,
  bloqueado = false,
}: {
  ordenId: string;
  piezas: PiezaOrden[];
  bloqueado?: boolean;
}) {
  const router = useRouter();
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [abrirAlta, setAbrirAlta] = useState(false);
  const [np, setNp] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const abiertas = piezas.filter(
    (p) => !["usada", "cancelada"].includes(p.estado),
  );
  const cerradas = piezas.filter((p) =>
    ["usada", "cancelada"].includes(p.estado),
  );

  async function patchPieza(id: string, body: Record<string, unknown>) {
    setOcupada(id);
    setErr(null);
    try {
      const r = await fetch(`/api/piezas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) setErr(data.error ?? "No se pudo actualizar.");
      else router.refresh();
    } catch {
      setErr("Error de red.");
    } finally {
      setOcupada(null);
    }
  }

  async function anotarUsada() {
    const numero = np.trim().toUpperCase();
    if (!numero) return;
    setOcupada("alta");
    setErr(null);
    try {
      const r = await fetch(`/api/ordenes/${ordenId}/piezas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_parte: numero,
          descripcion: desc.trim() || "Usada en sitio",
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setErr(data.error ?? "No se pudo anotar la pieza.");
      } else {
        setNp("");
        setDesc("");
        setAbrirAlta(false);
        router.refresh();
      }
    } catch {
      setErr("Error de red.");
    } finally {
      setOcupada(null);
    }
  }

  return (
    <div className="space-y-2">
      {abiertas.length === 0 && (
        <p className="text-xs italic text-muted">
          No hay piezas asociadas a esta orden.
        </p>
      )}

      {abiertas.map((p) => (
        <div
          key={p.id}
          className="rounded-xl border border-border-default bg-surface-2/50 p-2.5 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold">{p.numero_parte}</span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-muted">
              {ETIQUETA_ESTADO_PIEZA[p.estado]}
              {p.es_reposicion ? " · reposición" : ""}
            </span>
          </div>
          {p.descripcion && (
            <p className="mt-0.5 text-[11px] text-muted">{p.descripcion}</p>
          )}

          {!bloqueado && (p.estado === "apartada" || p.estado === "recibida") && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={ocupada === p.id}
                onClick={() => patchPieza(p.id, { estado: "usada" })}
                className="rounded-lg bg-success px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
              >
                Confirmar uso
              </button>
              {p.estado === "apartada" && (
                <button
                  type="button"
                  disabled={ocupada === p.id}
                  onClick={() => patchPieza(p.id, { resolver: "stock" })}
                  className="rounded-lg border border-border-default px-2.5 py-1 text-[11px] font-bold text-muted disabled:opacity-50"
                >
                  No se usó
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {cerradas.length > 0 && (
        <p className="pt-1 text-[11px] text-muted">
          {cerradas.length} pieza(s) ya resuelta(s):{" "}
          {cerradas
            .map((p) => `${p.numero_parte} (${ETIQUETA_ESTADO_PIEZA[p.estado]})`)
            .join(", ")}
        </p>
      )}

      {!bloqueado && (
        <div className="pt-1">
          {!abrirAlta ? (
            <button
              type="button"
              onClick={() => setAbrirAlta(true)}
              className="rounded-lg border border-success/50 bg-success/5 px-3 py-1.5 text-[11px] font-bold text-success"
            >
              + Anotar pieza usada
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-border-default bg-surface-2/50 p-2.5">
              <input
                value={np}
                onChange={(e) => setNp(e.target.value)}
                placeholder="Número de parte (ej. 40X7743)"
                className="w-full rounded-lg border border-border-default bg-surface p-2 text-xs font-bold"
              />
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Descripción (opcional)"
                className="w-full rounded-lg border border-border-default bg-surface p-2 text-xs"
              />
              {np.trim().length > 0 && !RE_NP.test(np.trim().toUpperCase()) && (
                <p className="text-[10px] text-muted">
                  Formato usual: 2 dígitos + X + 4 dígitos.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={ocupada === "alta"}
                  onClick={anotarUsada}
                  className="rounded-lg bg-success px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  Anotar
                </button>
                <button
                  type="button"
                  onClick={() => setAbrirAlta(false)}
                  className="rounded-lg border border-border-default px-3 py-1.5 text-[11px] font-bold text-muted"
                >
                  Cancelar
                </button>
              </div>
              <p className="text-[10px] text-muted">
                Almacén y coordinación concilian la salida y la reposición.
              </p>
            </div>
          )}
        </div>
      )}

      {err && <p className="text-[11px] font-semibold text-danger">{err}</p>}
    </div>
  );
}
