"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ETIQUETA_ESTADO_PIEZA, type PiezaOrden } from "@/lib/piezas";
import { claseEstadoPieza } from "@/lib/tema";
import { botonMini, botonSecMini, campo, chip } from "@/lib/ui";
import Colapsable from "@/components/Colapsable";

function IconoBasura() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

export default function SeccionPiezas({
  ordenId,
  piezas,
  stock,
  sugeridas,
  tieneSucursal,
  rol,
}: {
  ordenId: string;
  piezas: PiezaOrden[];
  stock: Record<string, number>;
  sugeridas: string[];
  tieneSucursal: boolean;
  rol: string;
}) {
  const esIngeniero = rol === "ingeniero" || rol === "Ingeniero";
  const estadoAlta = esIngeniero ? "en_espera" : "recomendada";
  const router = useRouter();
  const [np, setNp] = useState("");
  const [desc, setDesc] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [menuNoUsada, setMenuNoUsada] = useState<string | null>(null);

  async function api(
    url: string,
    method: string,
    body?: Record<string, unknown>,
  ) {
    setErr(null);
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      setErr(data.error ?? "No se pudo completar.");
      return false;
    }
    return true;
  }

  async function agregar(
    numeroParte: string,
    descripcion = "",
    estado = estadoAlta,
  ) {
    if (!numeroParte.trim()) return;
    setEnviando(true);
    if (
      await api(`/api/ordenes/${ordenId}/piezas`, "POST", {
        numero_parte: numeroParte,
        descripcion,
        estado,
      })
    ) {
      setNp("");
      setDesc("");
      router.refresh();
    }
    setEnviando(false);
  }

  async function setEstado(id: string, estado: string) {
    setEnviando(true);
    if (await api(`/api/piezas/${id}`, "PATCH", { estado })) router.refresh();
    setEnviando(false);
  }

  async function setValidada(id: string, v: boolean) {
    setEnviando(true);
    if (await api(`/api/piezas/${id}`, "PATCH", { validada_almacen: v }))
      router.refresh();
    setEnviando(false);
  }

  async function resolver(id: string, modo: string) {
    setEnviando(true);
    setMenuNoUsada(null);
    if (await api(`/api/piezas/${id}`, "PATCH", { resolver: modo }))
      router.refresh();
    setEnviando(false);
  }

  async function borrar(id: string) {
    setEnviando(true);
    if (await api(`/api/piezas/${id}`, "DELETE")) router.refresh();
    setEnviando(false);
  }

  async function irConRecomendadas() {
    const listas = piezas.filter(
      (p) => p.estado === "recomendada" && p.validada_almacen,
    );
    if (listas.length === 0) return;
    setEnviando(true);
    for (const p of listas) {
      if (!(await api(`/api/piezas/${p.id}`, "PATCH", { estado: "apartada" })))
        break;
    }
    router.refresh();
    setEnviando(false);
  }

  const disp = (n: string) => (tieneSucursal ? stock[n] : undefined);

  const recomendadas = piezas.filter((p) => p.estado === "recomendada");
  const apartadas = piezas.filter((p) => p.estado === "apartada");
  const enEspera = piezas.filter((p) => p.estado === "en_espera");
  const cerradas = piezas.filter((p) =>
    ["usada", "recibida", "cancelada"].includes(p.estado),
  );

  function Chip({ p }: { p: PiezaOrden }) {
    return (
      <span className={chip + " " + claseEstadoPieza(p.estado)}>
        {ETIQUETA_ESTADO_PIEZA[p.estado] ?? p.estado}
      </span>
    );
  }

  function Disp({ n }: { n: string }) {
    const v = disp(n);
    if (!tieneSucursal)
      return <span className="text-xs text-muted">sin sucursal</span>;
    if (v == null)
      return <span className="text-xs text-tone-warn-fg">no en catálogo</span>;
    return (
      <span
        className={
          "text-xs font-semibold " + (v > 0 ? "text-success" : "text-danger")
        }
      >
        {v} en stock
      </span>
    );
  }

  const validadasListas = recomendadas.filter((p) => p.validada_almacen).length;

  const resumen =
    piezas.length === 0
      ? "Sin piezas"
      : [
          recomendadas.length && `${recomendadas.length} recomendada(s)`,
          apartadas.length && `${apartadas.length} apartada(s)`,
          enEspera.length && `${enEspera.length} en espera`,
        ]
          .filter(Boolean)
          .join(" · ") || `${piezas.length} pieza(s)`;

  return (
    <Colapsable
      id={"piezas-" + ordenId}
      titulo={`Piezas (${piezas.length})`}
      resumen={resumen}
      icono={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 9l9-6 9 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
    >
      {err && (
        <p className="mb-2 rounded bg-danger/10 px-2 py-1 text-sm text-danger">
          {err}
        </p>
      )}

      {/* Sugerencias del resumen */}
      {sugeridas.length > 0 && (
        <div className="mb-3 rounded-lg bg-brand-050 p-2">
          <p className="mb-1 text-xs font-semibold text-brand">
            Números de parte detectados en el resumen:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sugeridas.map((s) => (
              <button
                key={s}
                type="button"
                disabled={enviando}
                onClick={() => agregar(s)}
                className="rounded-full border border-brand/40 bg-surface px-2.5 py-1 font-mono text-xs font-semibold text-brand hover:bg-brand hover:text-white"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recomendadas */}
      {recomendadas.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-tone-info-fg">
              Recomendadas ({recomendadas.length})
            </h3>
            <button
              type="button"
              className={botonMini}
              disabled={enviando || validadasListas === 0}
              onClick={irConRecomendadas}
              title={
                validadasListas === 0
                  ? "Valida al menos una pieza en almacén"
                  : ""
              }
            >
              {validadasListas > 0
                ? `Ir con ${validadasListas} pieza(s)`
                : "Ir con recomendadas"}
            </button>
          </div>
          <ul className="divide-y divide-border-default/70">
            {recomendadas.map((p) => (
              <li key={p.id} className="py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono font-semibold">
                    {p.numero_parte}
                  </span>
                  {p.descripcion && (
                    <span className="truncate text-muted">{p.descripcion}</span>
                  )}
                  <Disp n={p.numero_parte} />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setValidada(p.id, !p.validada_almacen)}
                    disabled={enviando}
                    className={
                      "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors " +
                      (p.validada_almacen
                        ? "bg-tone-ok-bg text-tone-ok-fg"
                        : "border border-border-default text-muted hover:bg-surface-2")
                    }
                  >
                    {p.validada_almacen ? "✓ Validada" : "Validar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEstado(p.id, "cancelada")}
                    className="text-xs font-semibold text-muted hover:text-text"
                    title="Hacer la visita sin esta pieza"
                  >
                    Ir sin pieza
                  </button>
                  <button
                    type="button"
                    onClick={() => borrar(p.id)}
                    className="ml-auto rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                    title="Borrar pieza"
                    aria-label="Borrar"
                  >
                    <IconoBasura />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Apartadas */}
      {apartadas.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-tone-violet-fg">
            Apartadas — el ingeniero las recoge ({apartadas.length})
          </h3>
          <ul className="divide-y divide-border-default/70">
            {apartadas.map((p) => (
              <li key={p.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono font-semibold">
                    {p.numero_parte}
                  </span>
                  {p.descripcion && (
                    <span className="text-muted">{p.descripcion}</span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      className={botonMini}
                      disabled={enviando}
                      onClick={() => setEstado(p.id, "usada")}
                    >
                      Confirmar uso
                    </button>
                    <button
                      type="button"
                      className={botonSecMini}
                      disabled={enviando}
                      onClick={() =>
                        setMenuNoUsada(menuNoUsada === p.id ? null : p.id)
                      }
                    >
                      No se usó ▾
                    </button>
                  </div>
                </div>
                {menuNoUsada === p.id && (
                  <div className="mt-2 flex flex-wrap gap-2 rounded-lg bg-surface-2 p-2 text-xs">
                    <span className="self-center text-muted">
                      Con visto bueno del gestor:
                    </span>
                    <button
                      type="button"
                      className={botonSecMini}
                      onClick={() => resolver(p.id, "stock")}
                    >
                      Regresar a stock
                    </button>
                    <button
                      type="button"
                      className={botonSecMini}
                      onClick={() => resolver(p.id, "retiro")}
                    >
                      Retirar de stock
                    </button>
                    <button
                      type="button"
                      className={botonSecMini}
                      onClick={() => resolver(p.id, "retorno")}
                    >
                      Retornar a Lexmark
                    </button>
                    <button
                      type="button"
                      className="self-center text-muted hover:text-text"
                      onClick={() => resolver(p.id, "devolver")}
                    >
                      (o volver a “recomendada”)
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* En espera / reposición */}
      {enEspera.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-tone-warn-fg">
            En espera de arribo ({enEspera.length})
          </h3>
          <ul className="divide-y divide-border-default/70">
            {enEspera.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
              >
                <span className="font-mono font-semibold">{p.numero_parte}</span>
                {p.es_reposicion && (
                  <span className="text-[10px] text-muted">(reposición)</span>
                )}
                {p.descripcion && (
                  <span className="text-muted">{p.descripcion}</span>
                )}
                <button
                  type="button"
                  className={botonMini + " ml-auto"}
                  disabled={enviando}
                  onClick={() => setEstado(p.id, "recibida")}
                >
                  Confirmar arribo
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Historial de piezas */}
      {cerradas.length > 0 && (
        <details className="mb-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-muted">
            Piezas cerradas ({cerradas.length})
          </summary>
          <ul className="mt-1 divide-y divide-border-default/70">
            {cerradas.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-3 py-1.5"
              >
                <span className="font-mono">{p.numero_parte}</span>
                {p.descripcion && (
                  <span className="text-muted">{p.descripcion}</span>
                )}
                <span className="ml-auto">
                  <Chip p={p} />
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {piezas.length === 0 && sugeridas.length === 0 && (
        <p className="text-sm text-muted">Sin piezas registradas.</p>
      )}

      {/* Alta manual */}
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border-default pt-3">
        <label className="text-xs text-muted">
          Número de parte
          <input
            value={np}
            onChange={(e) => setNp(e.target.value)}
            className={campo + " mt-0.5 block w-40"}
          />
        </label>
        <label className="text-xs text-muted">
          Descripción (opcional)
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className={campo + " mt-0.5 block"}
          />
        </label>
        {esIngeniero ? (
          <button
            type="button"
            onClick={() => agregar(np, desc, "en_espera")}
            disabled={enviando || !np.trim()}
            className={botonMini}
          >
            + Pedir pieza
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => agregar(np, desc, "recomendada")}
              disabled={enviando || !np.trim()}
              className={botonSecMini}
            >
              + Recomendada
            </button>
            <button
              type="button"
              onClick={() => agregar(np, desc, "en_espera")}
              disabled={enviando || !np.trim()}
              className={botonSecMini}
            >
              + En espera
            </button>
          </>
        )}
      </div>
    </Colapsable>
  );
}
