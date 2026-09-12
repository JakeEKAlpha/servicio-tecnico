"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OrdenListada } from "@/lib/ordenes/listar";
import type {
  IngenieroOpcion,
  SucursalOpcion,
} from "@/components/SelectorIngenieroSucursal";
import { claseEstatus, claseTono, chipServicio } from "@/lib/tema";
import { enlace, chip, tarjetaInteractiva } from "@/lib/ui";
import { badgeSla } from "@/lib/ordenes/sla";
import {
  COLUMNAS_TABLERO,
  ANCHO_MAX,
  anchoMinDe,
  type ColumnaTableroId,
} from "@/lib/ordenes/columnasTablero";
import AccionesOrden, { type OrdenAcciones } from "@/components/AccionesOrden";

/** "YYYY-MM-DD" -> "DD/MM/YYYY". */
function fmtFecha(f: string | null): string {
  if (!f) return "";
  const m = f.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : f;
}

function fechasReferencia() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const hoy = fmt.format(new Date());
  const manana = fmt.format(new Date(Date.now() + 24 * 60 * 60 * 1000));
  return { hoy, manana };
}

type SucursalConZona = SucursalOpcion & { zona_id?: string };

/** "Tabla" (densa, para comparar muchas órdenes) o "Tarjetas" (una orden a la
 *  vez, más fácil de leer). Elección del usuario, validada con mockup —
 *  ambas vistas se veían bien y pidió poder elegir. Persistida en
 *  `preferencias_usuario` bajo la clave `tablero_vista`. */
type Vista = "tabla" | "tarjetas";

type Fila = {
  o: OrdenListada;
  cerrada: boolean;
  fechaCls: string;
  servicio: { texto: string; tono: ReturnType<typeof chipServicio>["tono"] };
  ings: IngenieroOpcion[];
  sucursalesFila: SucursalConZona[];
  accionesOrden: OrdenAcciones;
  totalVisitas: number;
};

export default function TablaOrdenes({
  ordenes,
  ingenieros,
  sucursales,
  esGerencia,
  vistaInicial = "tabla",
  columnasOcultasIniciales = [],
  columnasAnchosIniciales = {},
}: {
  ordenes: OrdenListada[];
  ingenieros: IngenieroOpcion[];
  sucursales?: SucursalConZona[];
  esGerencia: boolean;
  /** Preferencias leídas en el servidor (`preferencias_usuario`). */
  vistaInicial?: Vista;
  columnasOcultasIniciales?: ColumnaTableroId[];
  columnasAnchosIniciales?: Partial<Record<ColumnaTableroId, number>>;
}) {
  const pathname = usePathname();
  // La URL se enmascara a /tablero/<id> mientras el panel de detalle está
  // abierto (ruta interceptada) — de ahí sacamos qué fila resaltar y cuándo
  // angostar la tabla.
  const idAbierto = pathname.match(/^\/tablero\/([^/]+)/)?.[1] ?? null;
  const compacto = !!idAbierto;

  const [vista, setVista] = useState<Vista>(vistaInicial);
  // Qué columnas ocultar se decide en Configuración (no aquí) — se lee una
  // sola vez al cargar la página; para verla actualizada hace falta recargar.
  const ocultas = new Set<ColumnaTableroId>(columnasOcultasIniciales);
  const [anchos, setAnchos] = useState<Partial<Record<ColumnaTableroId, number>>>(
    columnasAnchosIniciales,
  );
  const arrastre = useRef<{ id: ColumnaTableroId; x0: number; ancho0: number } | null>(
    null,
  );

  if (ordenes.length === 0) {
    return <p className="p-8 text-sm text-muted">No hay órdenes para mostrar.</p>;
  }

  const { hoy, manana } = fechasReferencia();

  const visitasPorOrden = new Map<string, number>();
  for (const o of ordenes) {
    visitasPorOrden.set(
      o.numero_orden,
      (visitasPorOrden.get(o.numero_orden) ?? 0) + 1,
    );
  }

  const filas: Fila[] = ordenes.map((o) => {
    const est = String(o.estatus ?? "");
    const cerrada = est === "Concluido" || est === "Cancelado";
    return {
      o,
      cerrada,
      fechaCls:
        !cerrada && o.fecha_eta === hoy
          ? "bg-hl-today font-semibold"
          : !cerrada && o.fecha_eta === manana
            ? "bg-hl-tomorrow font-semibold"
            : "",
      servicio: chipServicio(o.origen as string | null, o.marca_nombre),
      ings: esGerencia
        ? ingenieros.filter(
            (i) => (i as { zona_id?: string }).zona_id === o.zona_id,
          )
        : ingenieros,
      // Mismo criterio que `ings`: gerencia ve todas las zonas junto, así
      // que cada fila necesita solo las sucursales de SU zona.
      sucursalesFila: esGerencia
        ? (sucursales ?? []).filter((s) => s.zona_id === o.zona_id)
        : (sucursales ?? []),
      accionesOrden: {
        id: o.id,
        zona_id: o.zona_id,
        numero_orden: o.numero_orden,
        estatus: o.estatus,
        fecha_eta: o.fecha_eta,
        hora_eta: o.hora_eta,
        ingeniero_id: o.ingeniero_id,
        sucursal: o.sucursal,
      },
      totalVisitas: visitasPorOrden.get(o.numero_orden) ?? 1,
    };
  });

  /** Solo cambia la presentación (los datos ya están cargados) — no hace
   *  falta `router.refresh()`. Si el guardado falla, la próxima carga vuelve
   *  a la vista anterior; no es crítico bloquear la interacción por eso. */
  function cambiarVista(v: Vista) {
    if (v === vista) return;
    setVista(v);
    fetch("/api/preferencias", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clave: "tablero_vista", valor: v }),
    }).catch(() => undefined);
  }

  const columnasVisibles = COLUMNAS_TABLERO.filter(
    (c) =>
      (c.fijo || !ocultas.has(c.id)) && !(compacto && c.colapsaConPanel),
  );

  function anchoDe(id: ColumnaTableroId): number {
    return anchos[id] ?? COLUMNAS_TABLERO.find((c) => c.id === id)!.anchoDef;
  }

  /** Arrastrar el borde derecho de un encabezado para redimensionar la
   *  columna. Se persiste al soltar, no en cada pixel — evita saturar la
   *  API mientras el usuario todavía está ajustando. */
  function iniciarArrastre(id: ColumnaTableroId) {
    return (e: React.PointerEvent<HTMLSpanElement>) => {
      e.preventDefault();
      arrastre.current = { id, x0: e.clientX, ancho0: anchoDe(id) };
      e.currentTarget.setPointerCapture(e.pointerId);
    };
  }
  function moverArrastre(e: React.PointerEvent<HTMLSpanElement>) {
    const a = arrastre.current;
    if (!a) return;
    const nuevo = Math.min(
      ANCHO_MAX,
      Math.max(anchoMinDe(a.id), a.ancho0 + (e.clientX - a.x0)),
    );
    setAnchos((prev) => ({ ...prev, [a.id]: nuevo }));
  }
  function soltarArrastre(e: React.PointerEvent<HTMLSpanElement>) {
    const a = arrastre.current;
    if (!a) return;
    arrastre.current = null;
    // `anchos` (variable de closure) ya trae el último valor: cada
    // `pointermove` disparó un re-render antes de este `pointerup`. Leerlo
    // directamente es más simple y correcto que un updater de setState cuyo
    // único fin sería leer `prev` para un efecto secundario (fetch).
    fetch("/api/preferencias", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clave: "tablero_columnas_anchos", valor: anchos }),
    }).catch(() => undefined);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <>
      {/* --- Móvil: siempre tarjetas (no cabe una tabla densa) --- */}
      <ul className="space-y-2 p-3 md:hidden">
        {filas.map((f) => (
          <TarjetaOrden key={f.o.id} f={f} esGerencia={esGerencia} idAbierto={idAbierto} />
        ))}
      </ul>

      {/* --- Escritorio: Tabla o Tarjetas, a elección --- */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between gap-2 border-b border-border-default bg-surface-2/50 px-3 py-1.5">
          {vista === "tabla" ? (
            <Link
              href="/configuracion"
              className="text-[11px] font-semibold text-muted hover:text-brand hover:underline"
            >
              Elegir columnas y anchos en Configuración
            </Link>
          ) : (
            <span />
          )}
          <div
            className="inline-flex shrink-0 rounded-lg border border-border-default bg-surface p-0.5 text-xs font-bold"
            role="group"
            aria-label="Vista del tablero"
          >
            {(["tarjetas", "tabla"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => cambiarVista(v)}
                aria-pressed={vista === v}
                className={
                  "rounded-md px-2.5 py-1 transition-colors " +
                  (vista === v
                    ? "bg-brand-050 text-brand"
                    : "text-muted hover:text-text")
                }
              >
                {v === "tarjetas" ? "Tarjetas" : "Tabla"}
              </button>
            ))}
          </div>
        </div>

        {vista === "tarjetas" ? (
          <ul className="grid grid-cols-2 gap-3 p-3 xl:grid-cols-3">
            {filas.map((f) => (
              <TarjetaOrden
                key={f.o.id}
                f={f}
                esGerencia={esGerencia}
                idAbierto={idAbierto}
              />
            ))}
          </ul>
        ) : (
          <div className="scroll-oculto overflow-x-auto">
            <table className="border-collapse text-sm" style={{ tableLayout: "fixed" }}>
              <colgroup>
                {columnasVisibles.map((c) => (
                  <col key={c.id} style={{ width: anchoDe(c.id) }} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-border-default bg-surface-2 text-left text-[10px] font-extrabold uppercase tracking-wide text-text">
                  {columnasVisibles.map((c) => (
                    <th
                      key={c.id}
                      className="relative overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2.5"
                    >
                      {c.etiqueta}
                      <span
                        onPointerDown={iniciarArrastre(c.id)}
                        onPointerMove={moverArrastre}
                        onPointerUp={soltarArrastre}
                        onPointerCancel={soltarArrastre}
                        className="absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none select-none hover:bg-brand/30"
                        title="Arrastra para cambiar el ancho"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr
                    key={f.o.id}
                    className={
                      "border-b border-border-default/70 transition-colors " +
                      (f.o.id === idAbierto
                        ? "bg-brand-050"
                        : f.cerrada
                          ? "bg-surface-2/60 text-muted"
                          : "hover:bg-brand-050 even:bg-surface-2/40")
                    }
                  >
                    {columnasVisibles.map((c) => (
                      <td
                        key={c.id}
                        className="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2"
                      >
                        {celdaTablero(c.id, f, esGerencia)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

/** Contenido de una celda de la tabla de escritorio, por id de columna. */
function celdaTablero(id: ColumnaTableroId, f: Fila, esGerencia: boolean): React.ReactNode {
  const { o, fechaCls, servicio } = f;
  switch (id) {
    case "servicio":
      return (
        <span className={chip + " " + claseTono(servicio.tono)}>{servicio.texto}</span>
      );
    case "numero":
      return (
        <Link href={`/tablero/${o.id}`} className={enlace}>
          {o.numero_orden}
        </Link>
      );
    case "visitas":
      return <span className="text-muted">{o.numero_visita}</span>;
    case "cliente":
      return (
        <span title={o.cliente ?? ""} className="block truncate">
          {o.cliente}
        </span>
      );
    case "localidad":
      return o.localidad;
    case "estado":
      return o.estado;
    case "sucursal":
      return o.sucursal;
    case "ingeniero":
      return o.ingeniero_nombre ?? <span className="text-muted">—</span>;
    case "fecha_eta":
      return (
        <span className={"flex items-center gap-1.5 " + fechaCls}>
          {fmtFecha(o.fecha_eta)}
          {(() => {
            const b = badgeSla(o.horas_sla);
            return (
              b && <span className={chip + " " + claseTono(b.tono)}>{b.texto}</span>
            );
          })()}
        </span>
      );
    case "hora_eta":
      return o.hora_eta;
    case "estatus":
      return (
        <AccionesOrden
          orden={f.accionesOrden}
          ingenieros={f.ings}
          sucursales={f.sucursalesFila}
          esGerencia={esGerencia}
          totalVisitas={f.totalVisitas}
        />
      );
    default:
      return null;
  }
}

/** Una orden como tarjeta — usada siempre en móvil y, si el usuario elige
 *  "Tarjetas", también en escritorio. */
function TarjetaOrden({
  f,
  esGerencia,
  idAbierto,
}: {
  f: Fila;
  esGerencia: boolean;
  idAbierto: string | null;
}) {
  const { o, cerrada, servicio, ings, sucursalesFila, accionesOrden, totalVisitas } = f;
  return (
    <li
      className={
        tarjetaInteractiva +
        " " +
        (o.id === idAbierto ? "border-brand ring-1 ring-brand" : "") +
        " " +
        (cerrada ? "opacity-70" : "")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/tablero/${o.id}`}
            className="flex items-center gap-2 font-semibold"
          >
            <span className={chip + " " + claseTono(servicio.tono)}>
              {servicio.texto}
            </span>
            <span className={enlace}>{o.numero_orden}</span>
            <span className="text-xs font-normal text-muted">
              v{o.numero_visita}
            </span>
          </Link>
          <p className="mt-0.5 truncate text-sm">{o.cliente}</p>
          <p className="text-xs text-muted">
            {[o.localidad, o.estado].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={chip + " " + claseEstatus(o.estatus)}>{o.estatus}</span>
          {(() => {
            const b = badgeSla(o.horas_sla);
            return (
              b && <span className={chip + " " + claseTono(b.tono)}>{b.texto}</span>
            );
          })()}
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div>
          <dt className="text-muted">Ingeniero</dt>
          <dd>{o.ingeniero_nombre ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">ETA</dt>
          <dd>
            {fmtFecha(o.fecha_eta) || "—"}
            {o.hora_eta ? ` · ${o.hora_eta}` : ""}
          </dd>
        </div>
      </dl>

      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-border-default pt-2">
        {o.link_pdf && (
          <a
            href={o.link_pdf}
            target="_blank"
            rel="noreferrer"
            className={enlace + " text-xs"}
          >
            PDF
          </a>
        )}
        <div className="ml-auto">
          <AccionesOrden
            orden={accionesOrden}
            ingenieros={ings}
            sucursales={sucursalesFila}
            esGerencia={esGerencia}
            totalVisitas={totalVisitas}
          />
        </div>
      </div>
    </li>
  );
}
