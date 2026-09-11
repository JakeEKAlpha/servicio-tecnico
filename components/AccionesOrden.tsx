"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ESTATUS_MANUALES, ESTATUS_ORDEN } from "@/lib/ordenes/estatus";
import { claseEstatus } from "@/lib/tema";
import { boton, botonSec, botonPeligro, botonTexto, botonMini, campo, etiqueta } from "@/lib/ui";
import Modal from "@/components/Modal";
import PanelDeslizante from "@/components/tablero/PanelDeslizante";
import SelectorIngenieroSucursal, {
  type IngenieroOpcion,
  type SucursalOpcion,
} from "@/components/SelectorIngenieroSucursal";
import SelectorHora from "@/components/SelectorHora";

export type OrdenAcciones = {
  id: string;
  zona_id: string;
  numero_orden: string;
  estatus: string | null;
  fecha_eta: string | null;
  hora_eta: string | null;
  ingeniero_id: string | null;
  sucursal: string | null;
};

export default function AccionesOrden({
  orden,
  ingenieros,
  sucursales,
  esGerencia,
  totalVisitas,
}: {
  orden: OrdenAcciones;
  ingenieros: IngenieroOpcion[];
  sucursales?: SucursalOpcion[];
  esGerencia: boolean;
  totalVisitas: number;
}) {
  const router = useRouter();
  const bloqueada =
    orden.estatus === "Concluido" || orden.estatus === "Cancelado";

  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null); // estatus a confirmar
  const [asignando, setAsignando] = useState(false);
  const [pedirPiezas, setPedirPiezas] = useState(false);
  const [piezas, setPiezas] = useState<
    { numero_parte: string; descripcion: string }[]
  >([{ numero_parte: "", descripcion: "" }]);

  const [fecha, setFecha] = useState(orden.fecha_eta ?? "");
  const [hora, setHora] = useState(orden.hora_eta ?? "");
  const [ingeniero, setIngeniero] = useState(orden.ingeniero_id ?? "");
  const [sucursal, setSucursal] = useState(orden.sucursal ?? "");

  const opciones: readonly string[] = esGerencia
    ? ESTATUS_ORDEN
    : ESTATUS_MANUALES;

  async function patch(body: Record<string, unknown>) {
    setEnviando(true);
    setErr(null);
    try {
      const r = await fetch(`/api/ordenes/${orden.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setErr(data.error ?? "No se pudo guardar.");
      } else {
        setConfirmar(null);
        setAsignando(false);
        router.refresh();
      }
    } catch {
      setErr("Error de red.");
    } finally {
      setEnviando(false);
    }
  }

  function onCambioEstatus(nuevo: string) {
    if (nuevo === orden.estatus) return;
    if (nuevo === "Concluido" || nuevo === "Cancelado") {
      setConfirmar(nuevo);
      return;
    }
    if (nuevo === "Pendiente por partes") {
      setPiezas([{ numero_parte: "", descripcion: "" }]);
      setPedirPiezas(true);
      return;
    }
    patch({ estatus: nuevo });
  }

  async function guardarPiezasYEstatus() {
    setEnviando(true);
    setErr(null);
    try {
      const validas = piezas.filter((p) => p.numero_parte.trim());
      for (const p of validas) {
        const r = await fetch(`/api/ordenes/${orden.id}/piezas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            numero_parte: p.numero_parte,
            descripcion: p.descripcion,
            estado: "en_espera",
          }),
        });
        const data = await r.json();
        if (!r.ok || !data.ok) {
          setErr(data.error ?? "No se pudo guardar una pieza.");
          setEnviando(false);
          return;
        }
      }
      setPedirPiezas(false);
      await patch({ estatus: "Pendiente por partes" });
    } catch {
      setErr("Error de red.");
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          value={orden.estatus ?? ""}
          onChange={(e) => onCambioEstatus(e.target.value)}
          disabled={enviando || (bloqueada && !esGerencia)}
          className={
            "rounded-full border-0 px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand/30 " +
            claseEstatus(orden.estatus)
          }
        >
          {orden.estatus && !opciones.includes(orden.estatus) && (
            <option value={orden.estatus}>{orden.estatus}</option>
          )}
          {opciones.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {!bloqueada && (
          <button
            type="button"
            onClick={() => setAsignando(true)}
            title="Asignar ingeniero y fecha"
            className={botonMini}
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M5.75 3a.75.75 0 0 1 .75.75V5h7V3.75a.75.75 0 0 1 1.5 0V5h.25A2.75 2.75 0 0 1 18 7.75v6.5A2.75 2.75 0 0 1 15.25 17H4.75A2.75 2.75 0 0 1 2 14.25v-6.5A2.75 2.75 0 0 1 4.75 5H5V3.75A.75.75 0 0 1 5.75 3ZM3.5 9v5.25c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V9h-13Z" />
            </svg>
            Asignar
          </button>
        )}
      </div>
      {err && <span className="text-xs text-danger">{err}</span>}

      {/* Confirmar Concluir / Cancelar */}
      {confirmar && (
        <Modal
          titulo={`${confirmar === "Concluido" ? "Concluir" : "Cancelar"} orden ${orden.numero_orden}`}
          ancho="max-w-sm"
          centrado
          onClose={() => setConfirmar(null)}
        >
          <h2 className="text-base font-bold">
            {confirmar === "Concluido" ? "Concluir orden" : "Cancelar orden"}{" "}
            {orden.numero_orden}
          </h2>
          {confirmar === "Concluido" ? (
            <p className="text-sm text-muted">
              Esto concluye{" "}
              {totalVisitas > 1
                ? `las ${totalVisitas} visitas de la orden`
                : "la orden"}{" "}
              (excepto las canceladas). Revísalo antes de continuar.
            </p>
          ) : (
            <p className="text-sm text-muted">
              La orden quedará cancelada y ya no se podrá editar desde zona.
            </p>
          )}
          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmar(null)}
              className={botonSec}
            >
              No
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => patch({ estatus: confirmar })}
              className={confirmar === "Cancelado" ? botonPeligro : boton}
            >
              {enviando ? "…" : "Sí, continuar"}
            </button>
          </div>
        </Modal>
      )}

      {/* Asignar — panel lateral, no modal (wireframe 9e: "la decisión deja
          de ser a ciegas"; la disponibilidad real por ingeniero/fecha queda
          pendiente, ver D5 en docs/wireframe-integracion.md). */}
      {asignando && (
        <PanelDeslizante
          titulo={`Asignar ${orden.numero_orden}`}
          onCerrar={() => setAsignando(false)}
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className={etiqueta}>Fecha ETA</span>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className={campo}
                />
              </label>
              <div className="text-sm">
                <span className={etiqueta}>Hora ETA</span>
                <SelectorHora valor={hora} onCambio={setHora} />
              </div>
              <SelectorIngenieroSucursal
                ingenieros={ingenieros}
                sucursales={sucursales}
                sucursal={sucursal}
                ingenieroId={ingeniero}
                onSucursal={setSucursal}
                onIngeniero={setIngeniero}
              />
            </div>
            {err && <p className="text-sm text-danger">{err}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={enviando || !fecha || !hora || !ingeniero}
                onClick={() =>
                  patch({
                    fecha_eta: fecha,
                    hora_eta: hora,
                    ingeniero_id: ingeniero,
                    sucursal,
                  })
                }
                className={boton}
              >
                {enviando ? "Asignando…" : "Asignar y generar documento"}
              </button>
            </div>
          </div>
        </PanelDeslizante>
      )}

      {/* Piezas pedidas al pasar a "Pendiente por partes" */}
      {pedirPiezas && (
        <Modal
          titulo={`${orden.numero_orden}: piezas pedidas`}
          onClose={() => setPedirPiezas(false)}
        >
            <h2 className="text-base font-bold">
              {orden.numero_orden} → Pendiente por partes
            </h2>
            <p className="text-xs text-muted">
              ¿Qué piezas se pidieron? Quedan en el almacén como “en espera”.
            </p>
            <div className="space-y-2">
              {piezas.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={p.numero_parte}
                    onChange={(e) =>
                      setPiezas((arr) =>
                        arr.map((x, j) =>
                          j === i
                            ? { ...x, numero_parte: e.target.value }
                            : x,
                        ),
                      )
                    }
                    placeholder="No. de parte"
                    className={campo + " flex-1"}
                  />
                  <input
                    value={p.descripcion}
                    onChange={(e) =>
                      setPiezas((arr) =>
                        arr.map((x, j) =>
                          j === i
                            ? { ...x, descripcion: e.target.value }
                            : x,
                        ),
                      )
                    }
                    placeholder="Descripción (opcional)"
                    className={campo + " flex-1"}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setPiezas((arr) => [
                    ...arr,
                    { numero_parte: "", descripcion: "" },
                  ])
                }
                className={botonTexto}
              >
                + Otra pieza
              </button>
            </div>
            {err && <p className="text-sm text-danger">{err}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPedirPiezas(false)}
                className={botonSec}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={guardarPiezasYEstatus}
                className={boton}
              >
                {enviando ? "Guardando…" : "Guardar y marcar pendiente"}
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}
