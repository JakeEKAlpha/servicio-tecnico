"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  parsearReporteXerox,
  emparejarSucursal,
  type BloqueXerox,
} from "@/lib/importar/xerox";
import { MARCA_XEROX_ID } from "@/lib/marcas";
import { boton, botonSec, campo as campoCls, etiqueta } from "@/lib/ui";
import { Pegar } from "@/lib/iconos";
import Modal from "@/components/Modal";

export type SucursalOpcion = { id: string; nombre: string; zona_id: string };

type Fila = BloqueXerox & {
  incluir: boolean;
  sr: string;
  sucursalId: string;
};

function filasIniciales(
  bloques: BloqueXerox[],
  sucursales: SucursalOpcion[],
): Fila[] {
  return bloques.map((b) => ({
    ...b,
    incluir: true,
    sr: "",
    sucursalId: emparejarSucursal(b.ubicacion, sucursales)?.id ?? "",
  }));
}

/**
 * Captura de reportes Xerox pegados en formato WhatsApp (ver
 * lib/importar/xerox.ts): un número de tarea por visita, agrupados
 * opcionalmente bajo un encabezado de ciudad. El SR (reporte) no viene en el
 * texto — se captura a mano por fila antes de crear las órdenes.
 */
export default function ModalPegarXerox({
  sucursales,
  veTodo,
}: {
  sucursales: SucursalOpcion[];
  veTodo: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    creadas: number;
    total: number;
    fallas: { tarea: string; motivo: string }[];
  } | null>(null);

  const duplicadosTexto = useMemo(() => {
    if (!texto.trim()) return [];
    return parsearReporteXerox(texto).duplicados;
  }, [texto]);

  function analizar() {
    const { bloques } = parsearReporteXerox(texto);
    setFilas(filasIniciales(bloques, sucursales));
    setError(null);
    setResultado(null);
  }

  function actualizarFila(i: number, cambios: Partial<Fila>) {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...cambios } : f)));
  }

  function cerrar() {
    setAbierto(false);
    setTexto("");
    setFilas([]);
    setError(null);
    setResultado(null);
    setEnviando(false);
  }

  async function crear() {
    const incluidas = filas.filter((f) => f.incluir);
    if (incluidas.length === 0) {
      setError("No hay ninguna fila incluida.");
      return;
    }
    setEnviando(true);
    setError(null);
    const exitosas = new Set<string>();
    const fallas: { tarea: string; motivo: string }[] = [];
    for (const f of incluidas) {
      const sucursal = sucursales.find((s) => s.id === f.sucursalId) ?? null;
      // Gerencia no tiene zona propia: sin sucursal elegida no hay a dónde
      // mandar la orden — se lo decimos en vez de intentar y fallar 400.
      if (veTodo && !sucursal) {
        fallas.push({ tarea: f.tarea, motivo: "elige una sucursal" });
        continue;
      }
      const datosEspecificos: Record<string, string> = {};
      if (f.sr.trim()) datosEspecificos["SR"] = f.sr.trim();
      if (f.horario) datosEspecificos["Horario laboral"] = f.horario;
      try {
        const r = await fetch("/api/ordenes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cliente: f.cliente ?? "",
            falla: f.falla ?? "(sin descripción)",
            marca_id: MARCA_XEROX_ID,
            origen: "MANUAL",
            numero_orden: f.tarea,
            contacto: f.contacto,
            tel_movil: f.telefono,
            direccion: f.direccion,
            modelo: f.modelo,
            serie: f.serie,
            sucursal: sucursal?.nombre ?? f.ubicacion ?? undefined,
            ...(veTodo && sucursal ? { zona_id: sucursal.zona_id } : {}),
            datos_especificos: datosEspecificos,
          }),
        });
        const data = await r.json();
        if (r.ok && data.ok) exitosas.add(f.tarea);
        else fallas.push({ tarea: f.tarea, motivo: data.error ?? "error desconocido" });
      } catch {
        fallas.push({ tarea: f.tarea, motivo: "error de red" });
      }
    }
    // Las que sí se crearon salen de la lista; las fallidas se quedan para
    // corregir (p. ej. elegir sucursal) y reintentar sin repetir todo.
    setFilas((prev) => prev.filter((f) => !exitosas.has(f.tarea)));
    setResultado({ creadas: exitosas.size, total: incluidas.length, fallas });
    setEnviando(false);
    if (exitosas.size > 0) router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={botonSec + " inline-flex items-center gap-1.5"}
      >
        <Pegar className="h-3.5 w-3.5" />
        Pegar Xerox
      </button>

      {abierto && (
        <Modal titulo="Importar reportes Xerox" ancho="max-w-4xl" onClose={cerrar}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-extrabold text-brand">
              Importar reportes Xerox
            </h2>
            <button
              type="button"
              onClick={cerrar}
              className="text-[12px] font-bold text-muted hover:text-text"
            >
              Cerrar
            </button>
          </div>

          {resultado && filas.length === 0 ? (
            <>
              <p className="text-sm text-tone-ok-fg">
                {resultado.creadas} de {resultado.total} orden(es) creada(s).
                Todo listo.
              </p>
              <div className="flex justify-end">
                <button type="button" onClick={cerrar} className={boton}>
                  Listo
                </button>
              </div>
            </>
          ) : filas.length === 0 ? (
            <>
              <p className="text-xs text-muted">
                Pega uno o varios reportes tal cual (con el número de tarea
                entre asteriscos). Cada tarea se vuelve una orden — el SR se
                captura aparte, en el siguiente paso.
              </p>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={10}
                placeholder={"*5746235*\n▶️Modelo del equipo : …\n…"}
                className="w-full rounded-lg border border-border-default bg-surface p-2 font-mono text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              {duplicadosTexto.length > 0 && (
                <p className="text-xs text-tone-warn-fg">
                  Tarea(s) repetida(s) en el texto: {duplicadosTexto.join(", ")}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={cerrar} className={botonSec}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={analizar}
                  disabled={!texto.trim()}
                  className={boton}
                >
                  Analizar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted">
                {filas.length} tarea(s) detectada(s). Revisa y agrega el SR de
                cada una antes de crear las órdenes.
              </p>
              <div className="scroll-oculto max-h-[50vh] space-y-2 overflow-y-auto">
                {filas.map((f, i) => (
                  <div
                    key={f.tarea + i}
                    className="rounded-lg border border-border-default bg-surface-2/40 p-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={f.incluir}
                        onChange={(e) => actualizarFila(i, { incluir: e.target.checked })}
                        className="mt-1 h-4 w-4 shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span className="font-mono font-bold text-brand">
                            Tarea {f.tarea}
                          </span>
                          <span className="text-muted">
                            {f.cliente || "(sin cliente)"} · {f.modelo || "(sin modelo)"}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted">{f.falla}</p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          <label className="text-xs">
                            <span className={etiqueta}>SR (reporte)</span>
                            <input
                              className={campoCls}
                              value={f.sr}
                              onChange={(e) => actualizarFila(i, { sr: e.target.value })}
                              placeholder="opcional"
                            />
                          </label>
                          <label className="text-xs">
                            <span className={etiqueta}>Sucursal</span>
                            <select
                              className={campoCls}
                              value={f.sucursalId}
                              onChange={(e) =>
                                actualizarFila(i, { sucursalId: e.target.value })
                              }
                            >
                              <option value="">
                                {f.ubicacion ? `Sin coincidencia (${f.ubicacion})` : "—"}
                              </option>
                              {sucursales.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.nombre}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}
              {resultado && (
                <div className="space-y-1">
                  <p className="text-sm text-tone-ok-fg">
                    {resultado.creadas} de {resultado.total} orden(es) creada(s).
                  </p>
                  {resultado.fallas.length > 0 && (
                    <ul className="text-xs text-danger">
                      {resultado.fallas.map((f) => (
                        <li key={f.tarea}>
                          Tarea {f.tarea}: {f.motivo} — corrígela abajo y crea de nuevo.
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setFilas([])}
                  className={botonSec}
                  disabled={enviando}
                >
                  Atrás
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={cerrar} className={botonSec}>
                    {filas.length === 0 && resultado ? "Listo" : "Cancelar"}
                  </button>
                  <button
                    type="button"
                    onClick={crear}
                    disabled={enviando || filas.length === 0}
                    className={boton}
                  >
                    {enviando ? "Creando…" : "Crear órdenes"}
                  </button>
                </div>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
