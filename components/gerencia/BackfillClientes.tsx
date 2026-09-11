"use client";

import { useState } from "react";
import { boton, botonSec, campo as campoCls } from "@/lib/ui";

type Resultado = {
  procesadas: number;
  vinculadas: number;
  sinMatch: { id: string; cliente: string }[];
};

type ClienteOpcion = { id: string; nombre: string };

/**
 * Fila de vinculación manual — el complemento humano del backfill
 * automático. El matching por texto no puede saber que "DHL EXPRESS MEXICO"
 * y "DHL METROPOLITAN LOGISTICS" son la misma cuenta; esto sí.
 */
function FilaVincularManual({
  orden,
  clientes,
  onVinculada,
}: {
  orden: { id: string; cliente: string };
  clientes: ClienteOpcion[];
  onVinculada: (ordenId: string) => void;
}) {
  const [clienteId, setClienteId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vincular() {
    if (!clienteId) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch("/api/gerencia/vincular-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordenId: orden.id, clienteId }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error ?? "No se pudo vincular.");
      } else {
        onVinculada(orden.id);
      }
    } catch {
      setError("Error de red.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-1">
      <span className="min-w-0 flex-1 truncate">{orden.cliente || "(sin nombre)"}</span>
      <select
        className={campoCls + " !w-auto min-w-40"}
        value={clienteId}
        onChange={(e) => setClienteId(e.target.value)}
        disabled={enviando}
      >
        <option value="">— elegir cliente —</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={vincular}
        disabled={!clienteId || enviando}
        className={botonSec + " !py-1 !text-[11px]"}
      >
        {enviando ? "Vinculando…" : "Vincular"}
      </button>
      {error && <span className="w-full text-xs text-danger">{error}</span>}
    </li>
  );
}

/**
 * Disparador de un solo uso del backfill de `ordenes.cliente_id` —
 * `blueprints/cerrar-deuda-datos-blueprint.md`, Paso 2 — más la vinculación
 * manual para lo que el matching por texto no puede resolver solo.
 * Idempotente: correrlo de nuevo solo toca las órdenes que sigan sin
 * `cliente_id`, así que no hay riesgo real en dejarlo aquí después de la
 * primera corrida.
 */
export default function BackfillClientes({ clientes }: { clientes: ClienteOpcion[] }) {
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function correr() {
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const r = await fetch("/api/gerencia/backfill-clientes", { method: "POST" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error ?? "No se pudo correr el backfill.");
      } else {
        setResultado(data as Resultado);
      }
    } catch {
      setError("Error de red.");
    } finally {
      setCargando(false);
    }
  }

  function quitarDeSinMatch(ordenId: string) {
    setResultado((prev) =>
      prev
        ? { ...prev, sinMatch: prev.sinMatch.filter((s) => s.id !== ordenId) }
        : prev,
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-border-default bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-extrabold text-text">
            Vincular órdenes históricas a un cliente
          </p>
          <p className="text-xs text-muted">
            Busca cliente_id para cada orden que aún no lo tiene. Correrlo de
            nuevo no repite lo ya vinculado.
          </p>
        </div>
        <button type="button" onClick={correr} disabled={cargando} className={boton}>
          {cargando ? "Corriendo…" : "Correr backfill"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {resultado && (
        <div className="mt-2 text-xs text-muted">
          <p>
            Procesadas: <b>{resultado.procesadas}</b> · Vinculadas ahora:{" "}
            <b>{resultado.vinculadas}</b> · Sin match:{" "}
            <b>{resultado.sinMatch.length}</b>
          </p>
          {resultado.sinMatch.length > 0 && (
            <div className="mt-1">
              <p className="mb-1">
                El nombre no coincide con ningún cliente del directorio — o
                porque falta darlo de alta, o porque es el mismo cliente con
                otro nombre (ej. &ldquo;DHL EXPRESS MEXICO&rdquo; vs.
                &ldquo;DHL METROPOLITAN LOGISTICS&rdquo;). Vincúlalo a mano:
              </p>
              <ul className="divide-y divide-border-default">
                {resultado.sinMatch.map((s) => (
                  <FilaVincularManual
                    key={s.id}
                    orden={s}
                    clientes={clientes}
                    onVinculada={quitarDeSinMatch}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
