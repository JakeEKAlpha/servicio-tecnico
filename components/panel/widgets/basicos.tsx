import { useEffect, useState } from "react";
import Link from "next/link";
import { claseTono, chipServicio, type Tono } from "@/lib/tema";
import type { Kpi, Pendiente, Acceso, AgendaFila } from "@/lib/inicio/datos";
import type { Alerta, SeveridadAlerta, ItemAtencion } from "@/lib/panel/datos";

/* ------------------------------------------------------------------ */

export function KpiNumero({ kpi }: { kpi?: Kpi }) {
  if (!kpi) return <Vacio>Sin dato</Vacio>;
  // El título del widget ya dice la etiqueta; aquí solo el número.
  const cuerpo = (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <span
        className={
          "text-4xl font-extrabold leading-none tabular-nums " +
          (kpi.tono ? "text-brand" : "text-text")
        }
      >
        {kpi.valor}
      </span>
      {kpi.tono && (
        <span
          className={
            "inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-bold " +
            claseTono(kpi.tono)
          }
        >
          {kpi.tono === "warn" ? "requiere atención" : "al día"}
        </span>
      )}
    </div>
  );
  return kpi.href ? (
    <Link
      href={kpi.href}
      className="block h-full transition-colors hover:text-brand"
    >
      {cuerpo}
    </Link>
  ) : (
    cuerpo
  );
}

/* ------------------------------------------------------------------ */

export function KpiMedidor({ pct }: { pct: number | null }) {
  const v = pct ?? 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c * (1 - v / 100);
  return (
    <div className="flex h-full items-center gap-4">
      <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="8"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div>
        <div className="text-2xl font-extrabold tabular-nums text-text">
          {pct === null ? "—" : `${pct}%`}
        </div>
        <div className="text-xs font-semibold text-muted">Cumplimiento de ETA</div>
        <div className="mt-1 text-[11px] text-muted">7 días · meta 90%</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ListaPendientes({
  titulo,
  items,
}: {
  titulo: string;
  items: Pendiente[];
}) {
  if (items.length === 0) {
    return (
      <Vacio>
        {titulo}
        <br />
        Nada pendiente. 👌
      </Vacio>
    );
  }
  return (
    <ul className="divide-y divide-border-default">
      {items.map((p, i) => (
        <li key={i}>
          <Link
            href={p.href}
            className="block py-2.5 transition-colors hover:text-brand"
          >
            <span className="block truncate text-sm font-semibold text-text">
              {p.titulo}
            </span>
            <span className="block truncate text-xs text-muted">{p.detalle}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

const FECHA_HOY = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

export function AgendaHoy({ filas }: { filas: AgendaFila[] }) {
  if (filas.length === 0) return <Vacio>Nadie con visitas hoy.</Vacio>;
  return (
    <div className="flex h-full flex-col">
      <p className="mb-1.5 text-[11px] font-semibold capitalize text-muted">
        {FECHA_HOY}
      </p>
      <ul className="scroll-oculto min-h-0 flex-1 divide-y divide-border-default overflow-auto">
        {filas.map((a) => (
          <li
            key={a.ingeniero}
            className="flex items-center justify-between py-2 text-sm"
          >
            <span className="truncate">{a.ingeniero}</span>
            <span className="ml-2 shrink-0 rounded-full bg-brand-050 px-2 py-0.5 text-xs font-bold tabular-nums text-brand">
              {a.visitas}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type ZonaReloj = { id: string; etiqueta: string; zonaIana: string };

/** Las 3 zonas donde opera la empresa, cada una en un huso distinto
 *  (UTC-7/-6/-5, sin horario de verano desde la reforma de 2022). Lista
 *  simple a propósito: agregar otra ciudad es una línea más. */
const ZONAS_RELOJ: ZonaReloj[] = [
  { id: "bcs", etiqueta: "Baja CS", zonaIana: "America/Mazatlan" },
  { id: "cdmx", etiqueta: "CDMX", zonaIana: "America/Mexico_City" },
  { id: "cancun", etiqueta: "Cancún", zonaIana: "America/Cancun" },
];

function horaEnZona(zonaIana: string, ahora: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: zonaIana,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(ahora);
}

/**
 * Reloj por zona horaria — Baja California Sur, CDMX y Cancún caen en 3
 * husos distintos; coordinar entre zonas requiere ver las 3 horas a la vez.
 * Pedido del usuario 2026-09-11, solo para escritorio (marcado
 * `soloEscritorio` en el catálogo — en el celular ya se ve la hora del
 * sistema arriba).
 */
export function RelojesZona() {
  const [ahora, setAhora] = useState<Date | null>(null);

  useEffect(() => {
    // La hora depende del reloj del navegador — se calcula tras montar
    // (evita un mismatch de hidratación entre servidor y cliente) y se
    // refresca cada medio minuto, suficiente para un reloj sin segundos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAhora(new Date());
    const id = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid h-full grid-cols-3 gap-2">
      {ZONAS_RELOJ.map((z) => (
        <div
          key={z.id}
          className="flex flex-col items-center justify-center gap-1 rounded-lg bg-surface-2 py-3"
        >
          <span className="whitespace-nowrap text-2xl font-extrabold tabular-nums text-text">
            {ahora ? horaEnZona(z.zonaIana, ahora) : "—:—"}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {z.etiqueta}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const CLASE_SEVERIDAD: Record<SeveridadAlerta, Tono> = {
  critica: "rojo",
  alta: "orange",
  media: "warn",
};
const ETIQUETA_SEVERIDAD: Record<SeveridadAlerta, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
};

export function AlertasCriticas({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) {
    return <Vacio>Sin alertas abiertas. 👌</Vacio>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {alertas.map((a, i) => (
        <li key={i}>
          <Link
            href={a.href}
            className="flex items-start gap-3 rounded-lg bg-surface-2 p-2.5 transition-colors hover:bg-brand-050"
          >
            <span
              className={
                "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold " +
                claseTono(CLASE_SEVERIDAD[a.severidad])
              }
            >
              {ETIQUETA_SEVERIDAD[a.severidad]}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-text">
                {a.titulo}
              </span>
              <span className="line-clamp-2 text-xs text-muted">{a.detalle}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

const ETIQUETA_MOTIVO: Record<ItemAtencion["motivo"], string> = {
  vencido: "Vencido",
  sin_asignar: "Sin asignar",
};
const TONO_MOTIVO: Record<ItemAtencion["motivo"], Tono> = {
  vencido: "rojo",
  sin_asignar: "warn",
};

/**
 * "Necesita tu atención" — fusiona lo que antes eran 3 widgets separados
 * (KPI "Sin asignar", "Alertas críticas" de SLA, "Órdenes por asignar") en
 * una sola lista, con el chip de marca/servicio (WO/SR/Xerox/Alpha) para
 * identificar de un vistazo qué tipo de orden es. Decisión del usuario
 * 2026-09-11 tras validar el mockup: esas piezas contaban lo mismo dos veces.
 */
export function NecesitaAtencion({ items }: { items: ItemAtencion[] }) {
  if (items.length === 0) {
    return <Vacio>Nada requiere atención ahora mismo. 👌</Vacio>;
  }
  return (
    <ul className="scroll-oculto flex h-full flex-col gap-2 overflow-auto">
      {items.map((item) => {
        const chip = chipServicio(item.origen, item.marca_nombre);
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-lg bg-surface-2 p-2.5 transition-colors hover:bg-brand-050"
            >
              <span
                className={
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold " +
                  claseTono(TONO_MOTIVO[item.motivo])
                }
              >
                {ETIQUETA_MOTIVO[item.motivo]}
              </span>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold " +
                  claseTono(chip.tono)
                }
              >
                {chip.texto}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text">
                  {item.numero_orden}
                </span>
                <span className="block truncate text-xs text-muted">
                  {item.cliente ?? "Sin cliente"}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

export function AccesosRapidos({ accesos }: { accesos: Acceso[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {accesos.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex flex-col items-start gap-2 rounded-xl border border-border-default bg-surface-2/40 p-3 text-xs font-bold text-text transition-colors hover:border-brand/40 hover:text-brand"
        >
          <span className="text-brand">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d={a.d} />
            </svg>
          </span>
          {a.label}
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function FiltrosRapidos({ kpis }: { kpis: Kpi[] }) {
  const chips = kpis.filter((k) => k.href);
  if (chips.length === 0) return <Vacio>Sin filtros.</Vacio>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((k) => (
        <Link
          key={k.etiqueta}
          href={k.href!}
          className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface px-3 py-1 text-xs font-semibold text-text transition-colors hover:border-brand/40 hover:text-brand"
        >
          {k.etiqueta}
          <span className="rounded-full bg-surface-2 px-1.5 text-[11px] font-bold tabular-nums text-muted">
            {k.valor}
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <p className="grid h-full place-items-center text-center text-sm text-muted">
      <span>{children}</span>
    </p>
  );
}
