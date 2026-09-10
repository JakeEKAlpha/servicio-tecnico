import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RECURSOS, ROLES_PERFIL } from "@/lib/gerencia/recursos";
import { etiquetaRol } from "@/lib/auth/roles";
import GestionRecurso, { type Opcion } from "@/components/gerencia/GestionRecurso";

export default async function RecursoPage({
  params,
}: {
  params: Promise<{ recurso: string }>;
}) {
  const { recurso } = await params;
  const cfg = RECURSOS[recurso];
  if (!cfg) notFound();

  const supabase = await createClient();

  const [
    { data: filas },
    { data: zonas },
    { data: sucursales },
    { data: marcas },
    { data: gestores },
    { data: perfiles },
  ] = await Promise.all([
    supabase.from(cfg.tabla).select("*").order(cfg.orden),
    supabase.from("zonas").select("id, nombre").order("nombre"),
    supabase.from("sucursales").select("id, nombre").order("nombre"),
    supabase.from("marcas").select("id, nombre").order("nombre"),
    supabase.from("gestores_cuenta").select("id, nombre").order("nombre"),
    supabase.from("perfiles").select("id, nombre, rol").order("nombre"),
  ]);

  const opciones: Record<string, Opcion[]> = {
    zonas: (zonas ?? []).map((z) => ({ value: z.id, label: z.nombre })),
    marcas: (marcas ?? []).map((m) => ({ value: m.id, label: m.nombre })),
    gestores: (gestores ?? []).map((g) => ({ value: g.id, label: g.nombre })),
    perfiles: (perfiles ?? []).map((p) => ({
      value: p.id,
      label: `${p.nombre} (${etiquetaRol(p.rol)})`,
    })),
    sucursales: (sucursales ?? []).map((s) => ({
      value: s.nombre as string,
      label: s.nombre as string,
    })),
    sucursales_id: (sucursales ?? []).map((s) => ({
      value: s.id as string,
      label: s.nombre as string,
    })),
    roles: ROLES_PERFIL.map((r) => ({ value: r, label: etiquetaRol(r) })),
  };

  return (
    <GestionRecurso
      recurso={recurso}
      cfg={cfg}
      filas={(filas ?? []) as (Record<string, unknown> & { id: string })[]}
      opciones={opciones}
    />
  );
}
