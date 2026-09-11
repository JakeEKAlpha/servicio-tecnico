"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OrdenListada } from "@/lib/ordenes/listar";
import type { IngenieroOpcion } from "@/components/SelectorIngenieroSucursal";
import { colorOrden, claseEstatus } from "@/lib/tema";
import { enlace, chip, tarjetaInteractiva } from "@/lib/ui";
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

const COLUMNAS = [
  "Número",
  "Vis.",
  "Cliente",
  "Localidad",
  "Estado",
  "Sucursal",
  "Ingeniero",
  "Fecha ETA",
  "Hora ETA",
  "Doc",
  "PDF",
  "Estatus / acciones",
] as const;

/** Con el panel de detalle abierto la tabla se angosta: solo lo esencial. */
const OCULTA_CON_PANEL = new Set<(typeof COLUMNAS)[number]>([
  "Vis.",
  "Localidad",
  "Estado",
  "Sucursal",
  "Hora ETA",
  "Doc",
  "PDF",
]);

type Fila = {
  o: OrdenListada;
  cerrada: boolean;
  fechaCls: string;
  punto: string;
  ings: IngenieroOpcion[];
  accionesOrden: OrdenAcciones;
  totalVisitas: number;
};

export default function TablaOrdenes({
  ordenes,
  ingenieros,
  esGerencia,
}: {
  ordenes: OrdenListada[];
  ingenieros: IngenieroOpcion[];
  esGerencia: boolean;
}) {
  const pathname = usePathname();
  // La URL se enmascara a /tablero/<id> mientras el panel de detalle está
  // abierto (ruta interceptada) — de ahí sacamos qué fila resaltar y cuándo
  // angostar la tabla.
  const idAbierto = pathname.match(/^\/tablero\/([^/]+)/)?.[1] ?? null;
  const compacto = !!idAbierto;

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
      punto: colorOrden(o.origen as string | null, o.marca_nombre).punto,
      ings: esGerencia
        ? ingenieros.filter(
            (i) => (i as { zona_id?: string }).zona_id === o.zona_id,
          )
        : ingenieros,
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

  return (
    <>
      {/* --- Móvil: tarjetas --- */}
      <ul className="space-y-2 p-3 md:hidden">
        {filas.map(({ o, cerrada, punto, ings, accionesOrden, totalVisitas }) => (
          <li
            key={o.id}
            className={
              tarjetaInteractiva + " " + (cerrada ? "opacity-70" : "")
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/tablero/${o.id}`}
                  className="flex items-center gap-2 font-semibold"
                >
                  <span className={"h-2 w-2 shrink-0 rounded-full " + punto} />
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
              <span
                className={chip + " shrink-0 " + claseEstatus(o.estatus)}
              >
                {o.estatus}
              </span>
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
                  esGerencia={esGerencia}
                  totalVisitas={totalVisitas}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* --- Escritorio: tabla --- */}
      <div className="scroll-oculto hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              {COLUMNAS.filter((col) => !compacto || !OCULTA_CON_PANEL.has(col)).map(
                (col) => (
                  <th key={col} className="whitespace-nowrap px-3 py-2.5">
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map(
              ({ o, cerrada, fechaCls, punto, ings, accionesOrden, totalVisitas }) => (
                <tr
                  key={o.id}
                  className={
                    "border-b border-border-default/70 transition-colors " +
                    (o.id === idAbierto
                      ? "bg-brand-050"
                      : cerrada
                        ? "bg-surface-2/60 text-muted"
                        : "hover:bg-brand-050 even:bg-surface-2/40")
                  }
                >
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">
                    <span className="flex items-center gap-2">
                      <span
                        className={"h-2 w-2 shrink-0 rounded-full " + punto}
                        title={String(o.origen ?? "")}
                      />
                      <Link href={`/tablero/${o.id}`} className={enlace}>
                        {o.numero_orden}
                      </Link>
                    </span>
                  </td>
                  {!compacto && (
                    <td className="px-3 py-2 text-muted">{o.numero_visita}</td>
                  )}
                  <td className="px-3 py-2" title={o.cliente ?? ""}>
                    <div className="max-w-[15rem] truncate">{o.cliente}</div>
                  </td>
                  {!compacto && (
                    <td className="whitespace-nowrap px-3 py-2">{o.localidad}</td>
                  )}
                  {!compacto && (
                    <td className="whitespace-nowrap px-3 py-2">{o.estado}</td>
                  )}
                  {!compacto && (
                    <td className="whitespace-nowrap px-3 py-2">{o.sucursal}</td>
                  )}
                  <td className="whitespace-nowrap px-3 py-2">
                    {o.ingeniero_nombre ?? <span className="text-muted">—</span>}
                  </td>
                  <td className={"whitespace-nowrap px-3 py-2 " + fechaCls}>
                    {fmtFecha(o.fecha_eta)}
                  </td>
                  {!compacto && (
                    <td className="whitespace-nowrap px-3 py-2">{o.hora_eta}</td>
                  )}
                  {!compacto && (
                    <td className="px-3 py-2">
                      {o.link_doc ? (
                        <a
                          href={o.link_doc}
                          target="_blank"
                          rel="noreferrer"
                          className={enlace}
                        >
                          Abrir
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                  {!compacto && (
                    <td className="px-3 py-2">
                      {o.link_pdf ? (
                        <a
                          href={o.link_pdf}
                          target="_blank"
                          rel="noreferrer"
                          className={enlace}
                        >
                          PDF
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <AccionesOrden
                      orden={accionesOrden}
                      ingenieros={ings}
                      esGerencia={esGerencia}
                      totalVisitas={totalVisitas}
                    />
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
