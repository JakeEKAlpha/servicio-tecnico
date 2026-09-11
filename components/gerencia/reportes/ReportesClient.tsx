"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import GraficoFases from "@/components/panel/widgets/GraficoFases";
import GraficoFlujo from "@/components/panel/widgets/GraficoFlujo";
import GraficoBarrasCategoria from "@/components/gerencia/reportes/GraficoBarrasCategoria";
import FiltrosReportes, { type ValoresFiltro } from "@/components/gerencia/reportes/FiltrosReportes";
import { claseEstatus } from "@/lib/tema";
import { tarjeta, encabezadoSeccion, chip } from "@/lib/ui";
import { estadoSla, type OrdenAnalitica, type KpisReporte, type FilaIngeniero, type ConteoEtiqueta } from "@/lib/reportes/analitica";
import type { OpcionesFiltro } from "@/lib/reportes/datos";

type PuntoTendencia = { dia: string; proyectadas: number; completadas: number };
type FilaEstatus = { estatus: string; n: number };

const ETIQUETA_SLA: Record<string, string> = {
  cumplida: "Cumplida",
  incumplida: "Incumplida",
  en_riesgo: "En plazo",
  vencida: "Vencida",
  no_aplica: "N/A",
};
const TONO_SLA: Record<string, string> = {
  cumplida: "bg-tone-ok-bg text-tone-ok-fg",
  incumplida: "bg-tone-rojo-bg text-tone-rojo-fg",
  en_riesgo: "bg-tone-info-bg text-tone-info-fg",
  vencida: "bg-tone-rojo-bg text-tone-rojo-fg",
  no_aplica: "bg-tone-neutral-bg text-tone-neutral-fg",
};

type Columna = "numero_orden" | "cliente" | "estatus" | "sucursal_nombre" | "ingeniero_nombre" | "marca_nombre" | "creado_en" | "sla";

export default function ReportesClient({
  ordenes,
  error,
  opciones,
  kpis,
  estatus,
  tipoServicio,
  ingenieros,
  tendencia,
  vencidas,
  filtros,
}: {
  ordenes: OrdenAnalitica[];
  error: string | null;
  opciones: OpcionesFiltro;
  kpis: KpisReporte;
  estatus: FilaEstatus[];
  tipoServicio: ConteoEtiqueta[];
  ingenieros: FilaIngeniero[];
  tendencia: PuntoTendencia[];
  vencidas: OrdenAnalitica[];
  filtros: ValoresFiltro;
}) {
  const ahora = useMemo(() => new Date(), []);
  const [orden, setOrden] = useState<{ col: Columna; asc: boolean }>({
    col: "creado_en",
    asc: false,
  });

  const ingenierosEvaluables = ingenieros
    .filter((f) => f.tasaCumplimiento !== null)
    .slice(0, 8);

  const filasOrdenadas = useMemo(() => {
    const valor = (o: OrdenAnalitica, col: Columna): string => {
      if (col === "sla") return ETIQUETA_SLA[estadoSla(o, ahora)];
      return String(o[col] ?? "");
    };
    return [...ordenes].sort((a, b) => {
      const va = valor(a, orden.col);
      const vb = valor(b, orden.col);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return orden.asc ? cmp : -cmp;
    });
  }, [ordenes, orden, ahora]);

  function ordenarPor(col: Columna) {
    setOrden((prev) =>
      prev.col === col ? { col, asc: !prev.asc } : { col, asc: true },
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className={encabezadoSeccion}>Análisis de servicios</h2>
        <p className="mb-3 text-[12px] text-muted">
          Volumen, distribución y cumplimiento de SLA — calculado con datos reales de
          la app (creación, cierre e historial de estatus). El cumplimiento de SLA es
          mecánico (misma regla que ordena el Tablero): no captura justificantes de
          atraso atribuibles al cliente porque ese dato aún no se importa.
        </p>
      </div>

      <FiltrosReportes valores={filtros} opciones={opciones} />

      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          No se pudieron cargar las órdenes: {error}
        </p>
      )}

      {kpis.total === 0 ? (
        <div className={tarjeta + " text-center text-sm text-muted"}>
          Sin órdenes con los filtros actuales.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <TarjetaKpi etiqueta="Total" valor={String(kpis.total)} />
            <TarjetaKpi etiqueta="Activas" valor={String(kpis.activas)} />
            <TarjetaKpi
              etiqueta="Cumplimiento SLA"
              valor={kpis.tasaCumplimientoSla === null ? "—" : `${kpis.tasaCumplimientoSla}%`}
              nota={`${kpis.conSlaEvaluable} evaluadas`}
              tono={
                kpis.tasaCumplimientoSla !== null && kpis.tasaCumplimientoSla < 80
                  ? "warn"
                  : undefined
              }
            />
            <TarjetaKpi
              etiqueta="Vencidas ahora"
              valor={String(kpis.vencidasAbiertas)}
              tono={kpis.vencidasAbiertas > 0 ? "warn" : undefined}
            />
            <TarjetaKpi
              etiqueta="Días prom. de cierre"
              valor={kpis.diasPromedioConclusion === null ? "—" : String(kpis.diasPromedioConclusion)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className={tarjeta}>
              <p className="mb-2 text-[12px] font-bold text-text">Distribución por estatus</p>
              <div className="h-64">
                <GraficoFases datos={estatus} />
              </div>
            </div>
            <div className={tarjeta}>
              <p className="mb-2 text-[12px] font-bold text-text">
                Tendencia semanal — creadas vs. concluidas
              </p>
              <div className="h-64">
                <GraficoFlujo datos={tendencia} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className={tarjeta}>
              <p className="mb-2 text-[12px] font-bold text-text">Por tipo de servicio</p>
              <div className="h-64">
                <GraficoBarrasCategoria
                  etiquetas={tipoServicio.map((t) => t.etiqueta)}
                  valores={tipoServicio.map((t) => t.n)}
                />
              </div>
            </div>
            <div className={tarjeta}>
              <p className="mb-2 text-[12px] font-bold text-text">
                Cumplimiento de SLA por ingeniero
              </p>
              <div className="h-64">
                {ingenierosEvaluables.length === 0 ? (
                  <p className="grid h-full place-items-center text-sm text-muted">
                    Aún no hay servicios Lexmark concluidos para evaluar.
                  </p>
                ) : (
                  <GraficoBarrasCategoria
                    etiquetas={ingenierosEvaluables.map((f) => f.ingeniero)}
                    valores={ingenierosEvaluables.map((f) => f.tasaCumplimiento ?? 0)}
                    sufijo="%"
                  />
                )}
              </div>
            </div>
          </div>

          {vencidas.length > 0 && (
            <div className={tarjeta}>
              <p className="mb-2 text-[12px] font-bold text-text">
                Atención inmediata — SLA ya vencido, sigue abierta
              </p>
              <ul className="divide-y divide-border-default">
                {vencidas.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/tablero/${o.id}`}
                      className="flex items-center justify-between gap-3 py-2 text-sm transition-colors hover:text-brand"
                    >
                      <span className="min-w-0 truncate">
                        <b>{o.numero_orden}</b> — {o.cliente ?? "Sin cliente"}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {o.ingeniero_nombre ?? "Sin asignar"} · {o.sucursal_nombre ?? "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={tarjeta + " overflow-x-auto"}>
            <p className="mb-2 text-[12px] font-bold text-text">
              Detalle ({filasOrdenadas.length})
            </p>
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-border-default text-[10px] font-extrabold uppercase tracking-wide text-muted">
                  <Th col="numero_orden" orden={orden} onClick={ordenarPor}>Orden</Th>
                  <Th col="cliente" orden={orden} onClick={ordenarPor}>Cliente</Th>
                  <Th col="estatus" orden={orden} onClick={ordenarPor}>Estatus</Th>
                  <Th col="sucursal_nombre" orden={orden} onClick={ordenarPor}>Sucursal</Th>
                  <Th col="ingeniero_nombre" orden={orden} onClick={ordenarPor}>Ingeniero</Th>
                  <Th col="marca_nombre" orden={orden} onClick={ordenarPor}>Marca</Th>
                  <Th col="creado_en" orden={orden} onClick={ordenarPor}>Creada</Th>
                  <Th col="sla" orden={orden} onClick={ordenarPor}>SLA</Th>
                </tr>
              </thead>
              <tbody>
                {filasOrdenadas.map((o) => {
                  const sla = estadoSla(o, ahora);
                  return (
                    <tr key={o.id} className="border-b border-border-default/60 hover:bg-surface-2">
                      <td className="py-1.5 pr-3">
                        <Link href={`/tablero/${o.id}`} className="font-semibold text-brand hover:underline">
                          {o.numero_orden}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-3 max-w-[180px] truncate">{o.cliente ?? "—"}</td>
                      <td className="py-1.5 pr-3">
                        <span className={chip + " " + claseEstatus(o.estatus)}>{o.estatus ?? "—"}</span>
                      </td>
                      <td className="py-1.5 pr-3">{o.sucursal_nombre ?? "—"}</td>
                      <td className="py-1.5 pr-3">{o.ingeniero_nombre ?? "Sin asignar"}</td>
                      <td className="py-1.5 pr-3">{o.marca_nombre ?? "—"}</td>
                      <td className="py-1.5 pr-3 tabular-nums text-muted">
                        {new Date(o.creado_en).toLocaleDateString("es-MX")}
                      </td>
                      <td className="py-1.5 pr-3">
                        <span className={chip + " " + TONO_SLA[sla]}>{ETIQUETA_SLA[sla]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function TarjetaKpi({
  etiqueta,
  valor,
  nota,
  tono,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  tono?: "warn";
}) {
  return (
    <div className={tarjeta}>
      <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted">
        {etiqueta}
      </p>
      <p className={"text-2xl font-extrabold tabular-nums " + (tono === "warn" ? "text-tone-warn-fg" : "text-text")}>
        {valor}
      </p>
      {nota && <p className="mt-0.5 text-[11px] text-muted">{nota}</p>}
    </div>
  );
}

function Th({
  col,
  orden,
  onClick,
  children,
}: {
  col: Columna;
  orden: { col: Columna; asc: boolean };
  onClick: (col: Columna) => void;
  children: React.ReactNode;
}) {
  const activo = orden.col === col;
  return (
    <th
      className="cursor-pointer select-none py-2 pr-3 hover:text-text"
      onClick={() => onClick(col)}
    >
      {children}
      {activo && <span className="ml-1">{orden.asc ? "▲" : "▼"}</span>}
    </th>
  );
}
