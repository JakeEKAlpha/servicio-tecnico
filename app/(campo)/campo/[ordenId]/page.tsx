import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { COLUMNAS_CAMPO, type OrdenCampo } from "@/lib/campo/ordenes";
import type { Evidencia } from "@/lib/campo/evidencias";
import type { PiezaOrden } from "@/lib/piezas";
import { cuentaDeOrden } from "@/lib/cuentas/directorio";
import ServicioCampo from "@/components/campo/ServicioCampo";

export default async function OrdenCampoPage({
  params,
}: {
  params: Promise<{ ordenId: string }>;
}) {
  const { ordenId } = await params;
  const supabase = await createClient();
  const { perfil } = await perfilActual();

  const { data: orden } = await supabase
    .from("ordenes")
    .select(COLUMNAS_CAMPO)
    .eq("id", ordenId)
    .maybeSingle<OrdenCampo>();

  if (!orden) notFound();

  const esSoporte = esRolQueVeTodo(perfil.rol);
  const esSuya = !!perfil.ingeniero_id && orden.ingeniero_id === perfil.ingeniero_id;
  if (!esSoporte && !esSuya) {
    return (
      <div className="space-y-4">
        <Link href="/campo" className="text-sm font-semibold text-muted">
          ← Mis órdenes
        </Link>
        <div className="rounded-2xl border border-border-default bg-surface p-6 text-center text-sm text-muted">
          Esta orden no está asignada a ti.
        </div>
      </div>
    );
  }

  const [{ data: evidencias }, { data: piezas }, cuenta] = await Promise.all([
    supabase
      .from("evidencias")
      .select("*")
      .eq("orden_id", ordenId)
      .order("creada_en", { ascending: true }),
    supabase
      .from("piezas_orden")
      .select("*")
      .eq("orden_id", ordenId)
      .order("creada_en", { ascending: true }),
    cuentaDeOrden(supabase, orden.cliente),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href="/campo"
        className="inline-block text-sm font-semibold text-muted hover:text-[#004B25]"
      >
        ← Mis órdenes
      </Link>
      <ServicioCampo
        orden={orden}
        evidencias={(evidencias ?? []) as Evidencia[]}
        piezas={(piezas ?? []) as PiezaOrden[]}
        cuenta={cuenta}
      />
    </div>
  );
}
