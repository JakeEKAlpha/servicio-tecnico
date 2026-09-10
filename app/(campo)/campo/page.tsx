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

  return (
    <div className="space-y-4">
      <h1 className="text-xs font-black uppercase tracking-widest text-muted">
        Órdenes asignadas ({ordenes.length})
      </h1>

      {ordenes.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-surface p-8 text-center text-sm text-muted">
          No tienes órdenes pendientes en este momento.
        </div>
      ) : (
        <ul className="space-y-3">
          {ordenes.map((o) => (
            <li key={o.id}>
              <Link
                href={`/campo/${o.id}`}
                className="block overflow-hidden rounded-2xl border border-border-default bg-surface shadow-sm transition-colors hover:border-[#00A859]"
              >
                <div className="border-l-4 border-[#00A859] p-4">
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
                    <span className="text-[#004B25]">
                      {fmtFecha(o.fecha_eta)}
                      {o.hora_eta ? ` · ${o.hora_eta}` : ""}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
