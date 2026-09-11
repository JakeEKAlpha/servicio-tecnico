"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tarjeta, enlace, campo, boton, botonSec } from "@/lib/ui";

export type PiezaAlmacen = {
  id: string;
  numero_parte: string;
  descripcion: string | null;
  creada_en: string;
  recibida_en: string | null;
  orden: {
    id: string;
    numero_orden: string;
    cliente: string | null;
    estatus: string | null;
  } | null;
};

export type PiezaStock = {
  id: string;
  numero_parte: string;
  descripcion: string | null;
  disponible: number;
  apartada: number;
  minimo: number;
  ubicacion: string | null;
};

export type AlmacenSucursal = {
  id: string;
  sucursal: string;
  ciudad?: string | null;
  estado?: string | null;
  enEspera: PiezaAlmacen[];
  enStock: PiezaAlmacen[];
  stock: PiezaStock[];
};

type Mov = {
  id: string;
  numero_parte: string;
  tipo: string;
  cantidad: number;
  motivo: string | null;
  creado_en: string;
};

function coincide(a: AlmacenSucursal, q: string): boolean {
  if (!q) return true;
  const t = q.toLowerCase();
  return (
    a.sucursal.toLowerCase().includes(t) ||
    (a.ciudad ?? "").toLowerCase().includes(t) ||
    a.stock.some((p) => p.numero_parte.toLowerCase().includes(t))
  );
}

function bajoMinimo(a: AlmacenSucursal): number {
  return a.stock.filter((p) => p.minimo > 0 && p.disponible <= p.minimo).length;
}

export default function AlmacenPiezas({
  almacenes,
  catalogo,
  modo,
}: {
  almacenes: AlmacenSucursal[];
  catalogo: { numero_parte: string; descripcion: string | null }[];
  modo: "editar" | "ver";
}) {
  const router = useRouter();
  const editar = modo === "editar";
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [verVacios, setVerVacios] = useState(false);
  const [altaEn, setAltaEn] = useState<string | null>(null);
  const [altaNp, setAltaNp] = useState("");
  const [altaCant, setAltaCant] = useState("1");
  const [movsEn, setMovsEn] = useState<string | null>(null);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [activaId, setActivaId] = useState<string | null>(
    almacenes[0]?.id ?? null,
  );

  async function movimiento(
    sucursalId: string,
    numeroParte: string,
    tipo: "entrada" | "salida" | "ajuste",
    cantidad: number,
    motivo?: string,
  ) {
    setErr(null);
    try {
      const r = await fetch("/api/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursal_id: sucursalId,
          numero_parte: numeroParte,
          tipo,
          cantidad,
          motivo,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) setErr(data.error ?? "No se pudo registrar.");
      else router.refresh();
    } catch {
      setErr("Error de red.");
    }
  }

  async function ajusteInventario(id: string, body: Record<string, unknown>) {
    setErr(null);
    try {
      const r = await fetch(`/api/inventario/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) setErr(data.error ?? "No se pudo guardar.");
      else router.refresh();
    } catch {
      setErr("Error de red.");
    }
  }

  async function confirmarArribo(id: string) {
    setOcupada(id);
    setErr(null);
    try {
      const r = await fetch(`/api/piezas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "recibida" }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) setErr(data.error ?? "No se pudo confirmar.");
      else router.refresh();
    } catch {
      setErr("Error de red.");
    } finally {
      setOcupada(null);
    }
  }

  async function verMovimientos(sucursalId: string) {
    if (movsEn === sucursalId) {
      setMovsEn(null);
      return;
    }
    setMovsEn(sucursalId);
    setMovs([]);
    try {
      const r = await fetch(`/api/movimientos?sucursal_id=${sucursalId}`);
      const data = await r.json();
      if (data.ok) setMovs(data.filas);
    } catch {
      /* noop */
    }
  }

  async function agregarStock(sucursalId: string) {
    if (!altaNp.trim()) return;
    await movimiento(
      sucursalId,
      altaNp.trim().toUpperCase(),
      "entrada",
      Math.max(0, Number(altaCant) || 0),
      "Alta manual",
    );
    setAltaEn(null);
    setAltaNp("");
    setAltaCant("1");
  }

  // Resumen de todos los almacenes — "no perder el panorama" (wireframe 11l).
  const resumen = useMemo(
    () => ({
      piezas: almacenes.reduce(
        (n, a) => n + a.stock.reduce((m, p) => m + p.disponible, 0),
        0,
      ),
      bajoMinimo: almacenes.reduce((n, a) => n + bajoMinimo(a), 0),
      pedidas: almacenes.reduce((n, a) => n + a.enEspera.length, 0),
    }),
    [almacenes],
  );

  // El riel siempre lista todo; la búsqueda solo resalta/reordena para
  // encontrar rápido — nunca desaparece una sucursal a medio tecleo.
  const rielOrdenado = useMemo(() => {
    if (!q) return almacenes;
    const match = almacenes.filter((a) => coincide(a, q));
    const resto = almacenes.filter((a) => !coincide(a, q));
    return [...match, ...resto];
  }, [almacenes, q]);

  const activa =
    almacenes.find((a) => a.id === activaId) ?? almacenes[0] ?? null;

  if (almacenes.length === 0) {
    return (
      <p className="text-sm text-muted">
        No tienes almacenes asignados (revisa con gerencia).
      </p>
    );
  }

  const stockActiva = activa
    ? editar
      ? verVacios
        ? activa.stock
        : activa.stock.filter((p) => p.disponible > 0)
      : activa.stock.filter((p) => p.disponible > 0)
    : [];

  return (
    <div className="space-y-4">
      {/* Resumen de todos los almacenes */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-border-default bg-surface-2/60 px-4 py-2.5 text-sm">
        <span>
          <b className="tabular-nums">{resumen.piezas}</b>{" "}
          <span className="text-muted">piezas en stock</span>
        </span>
        <span className={resumen.bajoMinimo > 0 ? "text-tone-warn-fg" : "text-muted"}>
          <b className="tabular-nums">{resumen.bajoMinimo}</b> bajo mínimo
        </span>
        <span className="text-muted">
          <b className="tabular-nums text-text">{resumen.pedidas}</b> pedidas para
          órdenes
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar sucursal o número de parte…"
          className={campo + " ml-auto max-w-xs"}
        />
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Riel de sucursales */}
        <nav className="w-full shrink-0 space-y-1 md:w-56">
          {rielOrdenado.map((a) => {
            const bajo = bajoMinimo(a);
            const activo = a.id === activa?.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setActivaId(a.id)}
                className={
                  "flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors " +
                  (activo
                    ? "bg-brand-050 font-semibold text-brand"
                    : "text-text hover:bg-surface-2")
                }
              >
                <span className="min-w-0">
                  <span className="block truncate">{a.sucursal}</span>
                  {a.ciudad && (
                    <span className="block truncate text-xs font-normal text-muted">
                      {a.ciudad}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 gap-1">
                  {bajo > 0 && (
                    <span
                      className="rounded-full bg-tone-warn-bg px-1.5 text-[10px] font-bold text-tone-warn-fg"
                      title={`${bajo} pieza(s) bajo mínimo`}
                    >
                      {bajo}
                    </span>
                  )}
                  {a.enEspera.length > 0 && (
                    <span
                      className="rounded-full bg-tone-info-bg px-1.5 text-[10px] font-bold text-tone-info-fg"
                      title={`${a.enEspera.length} pedida(s)`}
                    >
                      {a.enEspera.length}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Detalle de la sucursal elegida */}
        {activa && (
          <section className={tarjeta + " min-w-0 flex-1"}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex flex-wrap items-baseline gap-2 border-l-4 border-brand pl-2 text-base font-bold">
                {activa.sucursal}
                {activa.ciudad && (
                  <span className="text-xs font-normal text-muted">
                    {activa.ciudad}
                    {activa.estado ? `, ${activa.estado}` : ""}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3">
                {editar && (
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={verVacios}
                      onChange={(e) => setVerVacios(e.target.checked)}
                    />
                    Ver sin existencias
                  </label>
                )}
                {editar && activa.id !== "__otras__" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={botonSec + " px-2 py-1 text-xs"}
                      onClick={() => verMovimientos(activa.id)}
                    >
                      {movsEn === activa.id ? "Ocultar movimientos" : "Movimientos"}
                    </button>
                    <button
                      type="button"
                      className={botonSec + " px-2 py-1 text-xs"}
                      onClick={() => setAltaEn(altaEn === activa.id ? null : activa.id)}
                    >
                      {altaEn === activa.id ? "Cerrar" : "+ Entrada"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {editar && altaEn === activa.id && (
              <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-surface-2 p-2">
                <label className="text-xs text-muted">
                  N.º de parte
                  <input
                    list="catalogo-piezas"
                    value={altaNp}
                    onChange={(e) => setAltaNp(e.target.value)}
                    className={campo + " mt-0.5 block w-40"}
                  />
                </label>
                <label className="text-xs text-muted">
                  Cantidad
                  <input
                    type="number"
                    min={0}
                    value={altaCant}
                    onChange={(e) => setAltaCant(e.target.value)}
                    className={campo + " mt-0.5 block w-20"}
                  />
                </label>
                <button
                  type="button"
                  className={boton}
                  onClick={() => agregarStock(activa.id)}
                >
                  Registrar entrada
                </button>
              </div>
            )}

            {editar && movsEn === activa.id && (
              <div className="mb-3 max-h-52 overflow-y-auto rounded-lg border border-border-default bg-surface-2 p-2 text-xs">
                {movs.length === 0 ? (
                  <p className="text-muted">Sin movimientos.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {movs.map((m) => (
                      <li key={m.id} className="flex justify-between gap-2">
                        <span>
                          <span className="font-mono">{m.numero_parte}</span> ·{" "}
                          <span
                            className={
                              m.tipo === "entrada"
                                ? "text-success"
                                : m.tipo === "salida"
                                  ? "text-danger"
                                  : "text-muted"
                            }
                          >
                            {m.tipo} {m.cantidad}
                          </span>
                          {m.motivo ? ` · ${m.motivo}` : ""}
                        </span>
                        <span className="text-muted">
                          {new Date(m.creado_en).toLocaleString("es-MX")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Pedidas para órdenes — lo primero que hay que atender */}
            {(activa.enEspera.length > 0 || editar) && (
              <div className="mb-4">
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-tone-warn-fg">
                  <span className="h-2 w-2 rounded-full bg-tone-warn-fg" />
                  Pedidas para órdenes ({activa.enEspera.length})
                </h3>
                {activa.enEspera.length === 0 ? (
                  <p className="text-sm text-muted">Nada en camino.</p>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      {activa.enEspera.map((p) => (
                        <tr key={p.id} className="border-b border-border-default/70">
                          <td className="py-1.5 pr-3 font-mono">{p.numero_parte}</td>
                          <td className="py-1.5 pr-3">{p.descripcion ?? "—"}</td>
                          <td className="py-1.5 pr-3">
                            {p.orden ? (
                              <Link href={`/tablero/${p.orden.id}`} className={enlace}>
                                {p.orden.numero_orden}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-1.5 pr-3 text-muted">
                            pedida {new Date(p.creada_en).toLocaleDateString("es-MX")}
                          </td>
                          {editar && (
                            <td className="py-1.5">
                              <button
                                type="button"
                                disabled={ocupada === p.id}
                                onClick={() => confirmarArribo(p.id)}
                                className="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                              >
                                {ocupada === p.id ? "…" : "Confirmar arribo"}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Stock */}
            {stockActiva.length === 0 ? (
              <p className="text-sm text-muted">Sin piezas con existencia.</p>
            ) : (
              <div className="scroll-oculto overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-default text-left text-xs font-semibold uppercase text-muted">
                      <th className="py-1 pr-3">Parte</th>
                      <th className="py-1 pr-3">Descripción</th>
                      <th className="py-1 pr-3">Disponible</th>
                      {editar && <th className="py-1 pr-3">Apartada</th>}
                      {editar && <th className="py-1 pr-3">Mín.</th>}
                      {editar && <th className="py-1 pr-3">Ubicación</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {stockActiva.map((p) => {
                      const bajo = p.disponible <= p.minimo && p.minimo > 0;
                      return (
                        <tr
                          key={p.id}
                          className={
                            "border-b border-border-default/70 " +
                            (bajo ? "bg-tone-warn-bg/40" : "")
                          }
                        >
                          <td className="py-1.5 pr-3 font-mono">{p.numero_parte}</td>
                          <td className="py-1.5 pr-3">{p.descripcion ?? "—"}</td>
                          <td className="py-1.5 pr-3">
                            {editar ? (
                              <span className="flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label="salida"
                                  className="h-6 w-6 rounded border border-border-default text-sm leading-none hover:bg-surface-2"
                                  onClick={() =>
                                    movimiento(activa.id, p.numero_parte, "salida", 1)
                                  }
                                >
                                  −
                                </button>
                                <span className="w-7 text-center font-semibold">
                                  {p.disponible}
                                </span>
                                <button
                                  type="button"
                                  aria-label="entrada"
                                  className="h-6 w-6 rounded border border-border-default text-sm leading-none hover:bg-surface-2"
                                  onClick={() =>
                                    movimiento(activa.id, p.numero_parte, "entrada", 1)
                                  }
                                >
                                  +
                                </button>
                              </span>
                            ) : (
                              <span className="font-semibold">{p.disponible}</span>
                            )}
                          </td>
                          {editar && (
                            <td className="py-1.5 pr-3 text-muted">
                              {p.apartada || "—"}
                            </td>
                          )}
                          {editar && (
                            <td className="py-1.5 pr-3">
                              <input
                                type="number"
                                defaultValue={p.minimo}
                                min={0}
                                className="w-14 rounded border border-border-default bg-surface px-1 py-0.5 text-sm"
                                onBlur={(e) => {
                                  const v = Math.max(0, Number(e.target.value) || 0);
                                  if (v !== p.minimo)
                                    ajusteInventario(p.id, { stock_minimo: v });
                                }}
                              />
                            </td>
                          )}
                          {editar && (
                            <td className="py-1.5 pr-3">
                              <input
                                defaultValue={p.ubicacion ?? ""}
                                placeholder="—"
                                className="w-24 rounded border border-border-default bg-surface px-1 py-0.5 text-sm"
                                onBlur={(e) => {
                                  if ((e.target.value || null) !== p.ubicacion)
                                    ajusteInventario(p.id, { ubicacion: e.target.value });
                                }}
                              />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {editar && (
        <datalist id="catalogo-piezas">
          {catalogo.map((c) => (
            <option key={c.numero_parte} value={c.numero_parte}>
              {c.descripcion ?? ""}
            </option>
          ))}
        </datalist>
      )}
    </div>
  );
}
