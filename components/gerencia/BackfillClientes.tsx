"use client";

import { useState } from "react";
import { boton } from "@/lib/ui";

type Resultado = {
  procesadas: number;
  vinculadas: number;
  sinMatch: { id: string; cliente: string }[];
};

/**
 * Disparador de un solo uso del backfill de `ordenes.cliente_id` —
 * `blueprints/cerrar-deuda-datos-blueprint.md`, Paso 2. Idempotente: correrlo
 * de nuevo solo toca las órdenes que sigan sin `cliente_id`, así que no hay
 * riesgo real en dejarlo aquí después de la primera corrida.
 */
export default function BackfillClientes() {
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
            <details className="mt-1">
              <summary className="cursor-pointer">
                Ver las que no encontraron cliente
              </summary>
              <ul className="mt-1 list-disc pl-4">
                {resultado.sinMatch.map((s) => (
                  <li key={s.id}>{s.cliente || "(sin nombre)"}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
