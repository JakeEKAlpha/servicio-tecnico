import Link from "next/link";
import { claseTono, type Tono } from "@/lib/tema";
import type { Kpi, Pendiente, Acceso, AgendaFila } from "@/lib/inicio/datos";
import type { Alerta, SeveridadAlerta } from "@/lib/panel/datos";

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
