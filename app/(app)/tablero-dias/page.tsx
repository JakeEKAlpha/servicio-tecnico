import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { listarOrdenes } from "@/lib/ordenes/listar";
import { hoyMx } from "@/lib/fechas";
import GanttDia, {
  type OrdenGantt,
  type IngGantt,
} from "@/components/GanttDia";

const ACCIONABLES = new Set([
  "Nuevo",
  "Pendiente",
  "Reagendado",
  "Asignado",
  "Lista para realizar",
  "Listo para continuar",
]);

export default async function TableroDiasPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { fecha: fechaParam } = await searchParams;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaParam ?? "")
    ? (fechaParam as string)
    : hoyMx();

  const supabase = await createClient();
  const { perfil } = await perfilActual();
  const esGerencia = esRolQueVeTodo(perfil.rol);

  let consultaIng = supabase
    .from("ingenieros")
    .select("id, nombre, sucursal_id")
    .eq("activo", true)
    .order("nombre");
  if (!esGerencia && perfil.zona_id) {
    consultaIng = consultaIng.eq("zona_id", perfil.zona_id);
  }
  const [{ data: ingenierosCrudos }, { data: sucursalesCat }] = await Promise.all([
    consultaIng,
    supabase.from("sucursales").select("id, nombre"),
  ]);

  // `ingenieros.sucursal` (texto) ya no existe en la BD — solo sucursal_id.
  // Se resuelve el nombre aquí y se ordena por él, igual que antes.
  const nombrePorSucursalId = new Map(
    (sucursalesCat ?? []).map((s) => [s.id, s.nombre] as const),
  );
  const ingenieros = (ingenierosCrudos ?? [])
    .map((i) => ({
      ...i,
      sucursal: i.sucursal_id ? (nombrePorSucursalId.get(i.sucursal_id) ?? null) : null,
    }))
    .sort((a, b) => (a.sucursal ?? "").localeCompare(b.sucursal ?? "") || a.nombre.localeCompare(b.nombre));

  const { ordenes } = await listarOrdenes(supabase, {});

  const agendadas: OrdenGantt[] = [];
  const sinAgendar: OrdenGantt[] = [];
  for (const o of ordenes) {
    const item: OrdenGantt = {
      id: o.id,
      numero_orden: o.numero_orden,
      cliente: o.cliente,
      estatus: o.estatus,
      origen: (o.origen as string | null) ?? null,
      marca_nombre: o.marca_nombre,
      hora_eta: o.hora_eta,
      ingeniero_id: o.ingeniero_id,
      horas_sla: o.horas_sla,
    };
    if (o.fecha_eta === fecha && o.ingeniero_id) {
      agendadas.push(item);
    } else if (ACCIONABLES.has(String(o.estatus))) {
      sinAgendar.push(item);
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-[18px] font-extrabold tracking-tight text-brand">
        Tablero por día
      </h1>
      <p className="mb-4 text-sm text-muted">
        Agenda visual por ingeniero. Arrastra las barras para reprogramar.
      </p>
      <GanttDia
        fecha={fecha}
        ingenieros={(ingenieros ?? []) as IngGantt[]}
        agendadas={agendadas}
        sinAgendar={sinAgendar}
      />
    </div>
  );
}
