import Link from "next/link";
import type { ResumenInicio } from "@/lib/inicio/datos";
import { claseTono } from "@/lib/tema";
import Revelar from "@/components/Revelar";

function Ico({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d={d} />
    </svg>
  );
}

export default function Dashboard({
  nombre,
  rolEtiqueta,
  resumen,
}: {
  nombre: string;
  rolEtiqueta: string;
  resumen: ResumenInicio;
}) {
  const primerNombre = nombre.split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Revelar>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand">
            Hola, {primerNombre}
          </h1>
          <p className="text-sm text-muted">
            {rolEtiqueta} · {resumen.contexto}
          </p>
        </div>
      </Revelar>

      {/* KPIs */}
      <Revelar delay={60}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {resumen.kpis.map((k) => {
            const cuerpo = (
              <>
                <span
                  className={
                    "text-3xl font-extrabold tabular-nums " +
                    (k.tono ? "text-brand" : "text-text")
                  }
                >
                  {k.valor}
                </span>
                <span className="mt-1 block text-xs font-semibold text-muted">
                  {k.etiqueta}
                </span>
                {k.tono && (
                  <span
                    className={
                      "mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold " +
                      claseTono(k.tono)
                    }
                  >
                    {k.tono === "warn" ? "requiere atención" : "al día"}
                  </span>
                )}
              </>
            );
            return k.href ? (
              <Link
                key={k.etiqueta}
                href={k.href}
                className="rounded-2xl border border-border-default bg-surface p-4 shadow-sm transition-colors hover:border-brand/40"
              >
                {cuerpo}
              </Link>
            ) : (
              <div
                key={k.etiqueta}
                className="rounded-2xl border border-border-default bg-surface p-4 shadow-sm"
              >
                {cuerpo}
              </div>
            );
          })}
        </div>
      </Revelar>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Pendientes */}
        <Revelar delay={120} className="min-w-0 lg:col-span-2">
          <section className="rounded-2xl border border-border-default bg-surface shadow-sm">
            <h2 className="border-b border-border-default px-4 py-3 text-sm font-bold text-text">
              {resumen.pendientesTitulo}
            </h2>
            {resumen.pendientes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                Nada pendiente. 👌
              </p>
            ) : (
              <ul className="divide-y divide-border-default">
                {resumen.pendientes.map((p, i) => (
                  <li key={i}>
                    <Link
                      href={p.href}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-brand-050"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-text">
                          {p.titulo}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {p.detalle}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Revelar>

        {/* Agenda de hoy + accesos */}
        <Revelar delay={180} className="min-w-0 space-y-4">
          {resumen.agendaHoy.length > 0 && (
            <section className="rounded-2xl border border-border-default bg-surface shadow-sm">
              <h2 className="border-b border-border-default px-4 py-3 text-sm font-bold text-text">
                Agenda de hoy
              </h2>
              <ul className="divide-y divide-border-default">
                {resumen.agendaHoy.map((a) => (
                  <li
                    key={a.ingeniero}
                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                  >
                    <span className="truncate">{a.ingeniero}</span>
                    <span className="ml-2 shrink-0 rounded-full bg-brand-050 px-2 py-0.5 text-xs font-bold text-brand tabular-nums">
                      {a.visitas}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-border-default bg-surface p-2 shadow-sm">
            <h2 className="px-2 py-2 text-sm font-bold text-text">Accesos</h2>
            <div className="grid grid-cols-2 gap-2">
              {resumen.accesos.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex flex-col items-start gap-2 rounded-xl border border-border-default bg-surface-2/40 p-3 text-xs font-bold text-text transition-colors hover:border-brand/40 hover:text-brand"
                >
                  <span className="text-brand">
                    <Ico d={a.d} />
                  </span>
                  {a.label}
                </Link>
              ))}
            </div>
          </section>
        </Revelar>
      </div>
    </div>
  );
}
