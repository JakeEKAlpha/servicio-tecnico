import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import DetalleOrden, { type OrdenDetalle } from "@/components/DetalleOrden";
import SeccionPiezas from "@/components/SeccionPiezas";
import { detectarNumerosParte, type PiezaOrden } from "@/lib/piezas";
import { cuentaDeOrden } from "@/lib/cuentas/directorio";

/**
 * Toda la carga de datos de una orden + su render. La comparten:
 *  - `/tablero/[ordenId]` (página completa — navegación directa o refresh)
 *  - `/tablero/@panel/(.)[ordenId]` (panel lateral — desde el tablero, sin
 *    salir de la lista; ver docs/wireframe-integracion.md, pantalla 1)
 */
export default async function DetalleOrdenCargado({
  ordenId,
}: {
  ordenId: string;
}) {
  const supabase = await createClient();

  const [{ perfil }, { data: orden }] = await Promise.all([
    perfilActual(),
    supabase
      .from("ordenes")
      .select("*, ingenieros(nombre), marcas(nombre)")
      .eq("id", ordenId)
      .maybeSingle(),
  ]);

  if (!orden) {
    notFound();
  }

  const esGerencia = esRolQueVeTodo(perfil.rol);

  const [
    { data: ingenieros },
    { data: historial },
    { data: piezas },
    { data: zonas },
    { data: sucursales },
    cuenta,
  ] = await Promise.all([
    supabase
      .from("ingenieros")
      .select("id, nombre, sucursal")
      .eq("zona_id", orden.zona_id)
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("ordenes_historial")
      .select("estatus_anterior, estatus_nuevo, cambiado_en")
      .eq("orden_id", ordenId)
      .order("cambiado_en", { ascending: false }),
    supabase
      .from("piezas_orden")
      .select("*")
      .eq("orden_id", ordenId)
      .order("creada_en", { ascending: true }),
    esGerencia
      ? supabase.from("zonas").select("id, nombre").order("nombre")
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    supabase
      .from("sucursales")
      .select("id, nombre")
      .eq("zona_id", orden.zona_id)
      .eq("activa", true)
      .order("nombre"),
    cuentaDeOrden(supabase, orden.cliente, orden.cliente_id),
  ]);

  // Stock de la sucursal de la orden, para mostrar disponibilidad por pieza.
  const stock: Record<string, number> = {};
  if (orden.sucursal_id) {
    const { data: inv } = await supabase
      .from("inventario")
      .select("numero_parte, cantidad_disponible")
      .eq("sucursal_id", orden.sucursal_id);
    for (const r of inv ?? []) {
      stock[r.numero_parte as string] = (r.cantidad_disponible as number) ?? 0;
    }
  }

  // Números de parte que aparecen en el resumen / falla / comentarios.
  const yaRegistradas = new Set(
    ((piezas ?? []) as PiezaOrden[]).map((p) => p.numero_parte),
  );
  const sugeridas = [
    ...detectarNumerosParte(
      [orden.falla, orden.comentarios, orden.partes_recomendadas]
        .filter(Boolean)
        .join("\n"),
    ),
  ].filter((np) => !yaRegistradas.has(np));

  const detalle: OrdenDetalle = {
    ...orden,
    ingeniero_nombre: orden.ingenieros?.nombre ?? null,
    marca_nombre: orden.marcas?.nombre ?? null,
  };

  return (
    <DetalleOrden
      orden={detalle}
      ingenieros={ingenieros ?? []}
      historial={historial ?? []}
      esGerencia={esGerencia}
      zonas={zonas ?? []}
      cuenta={cuenta}
      slotPiezas={
        <SeccionPiezas
          ordenId={ordenId}
          piezas={(piezas ?? []) as PiezaOrden[]}
          stock={stock}
          sugeridas={sugeridas}
          tieneSucursal={!!orden.sucursal_id}
          rol={perfil.rol}
          sucursales={sucursales ?? []}
          sucursalActual={orden.sucursal_id ?? null}
        />
      }
    />
  );
}
