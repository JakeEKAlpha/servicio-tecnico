import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import {
  ordenesDelIngeniero,
  COLUMNAS_CAMPO,
  type OrdenCampo,
} from "@/lib/campo/ordenes";
import { claseEstatus } from "@/lib/tema";
import { hoyMx } from "@/lib/fechas";

function fmtFecha(f: string | null): string {
  if (!f) return "Sin fecha";
  const m = f.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : f;
}

export default async function CampoInicioPage() {
  const { perfil } = await perfilActual();
  const supabase = await createClient();
  const soporte = esRolQueVeTodo(perfil.rol) && !perfil.ingeniero_id;

  if (!perfil.ingeniero_id && !soporte) {
    return (
      <div className="rounded-2xl border border-border-default bg-surface p-6 text-center text-sm text-muted">
        Tu usuario todavía no está enlazado a una ficha de ingeniero. Pídele a
        coordinación que lo configure en el panel de gerencia.
      </div>
    );
  }

  const ordenes = perfil.ingeniero_id
    ? await ordenesDelIngeniero(supabase, perfil.ingeniero_id)
    : (
        (
          await supabase
            .from("ordenes")
            .select(COLUMNAS_CAMPO)
            .not("estatus", "in", "(Concluido,Cancelado)")
            .order("fecha_eta", { ascending: true, nullsFirst: false })
        ).data ?? []
      ).slice(0, 40) as unknown as OrdenCampo[];

  const hoy = hoyMx();
  const nHoy = ordenes.filter((o) => o.fecha_eta === hoy).length;
  const nEnCurso = ordenes.filter((o) => o.hora_inicio_real).length;
  const primerNombre = perfil.nombre.split(/\s+/)[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-extrabold text-success">
          Hola, {primerNombre}
        </h1>
        <p className="text-xs font-semibold text-muted">
          {perfil.zona_nombre ?? "Servicio en sitio"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { n: ordenes.length, t: "Asignadas" },
          { n: nHoy, t: "Para hoy" },
          { n: nEnCurso, t: "En curso" },
        ].map((k) => (
          <div
            key={k.t}
            className="rounded-2xl border border-border-default bg-surface p-3 text-center"
          >
            <div className="text-2xl font-extrabold tabular-nums text-success">
              {k.n}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
              {k.t}
            </div>
          </div>
        ))}
      </div>

      <h2 className="pt-1 text-xs font-black uppercase tracking-widest text-muted">
        Órdenes asignadas
      </h2>

      {ordenes.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-surface p-8 text-center text-sm text-muted">
          No tienes órdenes pendientes en este momento.
        </div>
      ) : (
        <ul className="space-y-3">
          {ordenes.map((o) => {
            const cerrada = o.estatus === "Concluido" || o.estatus === "Cancelado";
            const esHoy = !cerrada && o.fecha_eta === hoy;
            const atrasada =
              !cerrada && !o.hora_inicio_real && !!o.fecha_eta && o.fecha_eta < hoy;
            return (
              <li key={o.id}>
                <Link
                  href={`/campo/${o.id}`}
                  className="block overflow-hidden rounded-2xl border border-border-default bg-surface p-4 shadow-sm transition-[transform,box-shadow,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-success/50 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-muted">
                        {o.numero_orden} · visita {o.numero_visita ?? 1}
                      </p>
                      <p className="truncate text-base font-extrabold text-text">
                        {o.cliente ?? "—"}
                      </p>
                    </div>
                    <span
                      className={
                        "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold " +
                        claseEstatus(o.estatus)
                      }
                    >
                      {o.estatus}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted">
                    {[o.modelo, o.serie].filter(Boolean).join(" · ") || "Equipo sin datos"}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-text/80">
                    {o.falla ?? "Sin reporte"}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-border-default pt-2 text-[11px] font-bold">
                    <span className="text-muted">
                      {[o.localidad, o.estado].filter(Boolean).join(", ")}
                    </span>
                    <span
                      className={
                        "rounded-md px-1.5 py-0.5 " +
                        (atrasada
                          ? "bg-tone-rojo-bg text-tone-rojo-fg"
                          : esHoy
                            ? "bg-hl-today text-success"
                            : "text-success")
                      }
                    >
                      {atrasada ? "Atrasada · " : esHoy ? "Hoy · " : ""}
                      {fmtFecha(o.fecha_eta)}
                      {o.hora_eta ? ` · ${o.hora_eta}` : ""}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
