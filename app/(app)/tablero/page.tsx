import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { listarOrdenes } from "@/lib/ordenes/listar";
import { prioridadDe } from "@/lib/ordenes/estatus";
import { claseEstatus } from "@/lib/tema";
import { chip, campo, botonSec } from "@/lib/ui";
import { Buscar } from "@/lib/iconos";
import Revelar from "@/components/Revelar";
import TablaOrdenes from "@/components/TablaOrdenes";
import ModalPegarWOSR from "@/components/ModalPegarWOSR";
import ModalNuevaOrden from "@/components/ModalNuevaOrden";

export default async function TableroPage({
  searchParams,
}: {
  searchParams: Promise<{ activos?: string; q?: string }>;
}) {
  const { activos, q } = await searchParams;
  const soloActivos = activos === "1";
  const busqueda = (q ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const { perfil } = await perfilActual();
  const { ordenes, error } = await listarOrdenes(supabase, { soloActivos });

  const esGerencia = esRolQueVeTodo(perfil.rol);

  // Ingenieros para asignar: los de la zona del coordinador, o todos si es
  // gerencia (la tabla los filtra por zona de cada orden).
  let consultaIng = supabase
    .from("ingenieros")
    .select("id, nombre, sucursal, zona_id")
    .eq("activo", true)
    .order("nombre");
  if (!esGerencia && perfil.zona_id) {
    consultaIng = consultaIng.eq("zona_id", perfil.zona_id);
  }
  const [{ data: ingenieros }, { data: marcas }] = await Promise.all([
    consultaIng,
    supabase.from("marcas").select("id, nombre").order("nombre"),
  ]);

  // Conteo por estatus (del conjunto cargado, antes de la búsqueda).
  const conteos = new Map<string, number>();
  for (const o of ordenes) {
    const e = String(o.estatus ?? "—");
    conteos.set(e, (conteos.get(e) ?? 0) + 1);
  }
  const chips = [...conteos.entries()].sort(
    (a, b) => prioridadDe(a[0]) - prioridadDe(b[0]),
  );

  const filtradas = busqueda
    ? ordenes.filter(
        (o) =>
          o.numero_orden.toLowerCase().includes(busqueda) ||
          (o.cliente ?? "").toLowerCase().includes(busqueda) ||
          (o.ingeniero_nombre ?? "").toLowerCase().includes(busqueda),
      )
    : ordenes;

  return (
    <div className="p-6">
      {/* Fila 1: título + acciones principales */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight text-brand">
            Tablero de órdenes
          </h1>
          <p className="text-[12px] text-muted">
            {filtradas.length}
            {busqueda ? ` de ${ordenes.length}` : ""} órden
            {filtradas.length === 1 ? "" : "es"}
            {soloActivos ? " activas" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModalPegarWOSR />
          {perfil.zona_id && (
            <ModalNuevaOrden
              ingenieros={(ingenieros ?? []).filter(
                (i) => i.zona_id === perfil.zona_id,
              )}
              marcas={marcas ?? []}
            />
          )}
        </div>
      </div>

      {/* Fila 2: buscar + filtros, juntos */}
      <Revelar delay={40} className="mb-4 flex flex-wrap items-center gap-2">
        <form method="GET" className="relative flex items-center">
          {soloActivos && <input type="hidden" name="activos" value="1" />}
          <label htmlFor="buscar-orden" className="sr-only">
            Buscar por número de orden, cliente o ingeniero
          </label>
          <Buscar className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
          <input
            id="buscar-orden"
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar orden, cliente, ingeniero…"
            className={campo + " w-64 pl-9"}
          />
        </form>
        <Link
          href={soloActivos ? "/tablero" : "/tablero?activos=1"}
          className={botonSec}
        >
          {soloActivos ? "Ver todas" : "Solo activas"}
        </Link>
        {chips.map(([estatus, n]) => (
          <span key={estatus} className={chip + " " + claseEstatus(estatus)}>
            {estatus}
            <span className="ml-1.5 rounded-full bg-black/10 px-1.5 text-[10px]">
              {n}
            </span>
          </span>
        ))}
      </Revelar>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          No se pudieron cargar las órdenes: {error}
        </p>
      ) : (
        <Revelar
          delay={90}
          className="overflow-hidden rounded-xl border border-border-default bg-surface shadow-sm"
        >
          <TablaOrdenes
            ordenes={filtradas}
            ingenieros={ingenieros ?? []}
            esGerencia={esGerencia}
          />
        </Revelar>
      )}
    </div>
  );
}
