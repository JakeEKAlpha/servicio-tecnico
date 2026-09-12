import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { listarOrdenes } from "@/lib/ordenes/listar";
import { leerPreferencias } from "@/lib/panel/datos";
import { IDS_OCULTABLES, IDS_COLUMNAS_TABLERO, type ColumnaTableroId } from "@/lib/ordenes/columnasTablero";
import { prioridadDe } from "@/lib/ordenes/estatus";
import { claseEstatus } from "@/lib/tema";
import { chip, campo } from "@/lib/ui";
import { Buscar } from "@/lib/iconos";
import Revelar from "@/components/Revelar";
import TablaOrdenes from "@/components/TablaOrdenes";
import ModalPegarWOSR from "@/components/ModalPegarWOSR";
import ModalPegarXerox from "@/components/ModalPegarXerox";
import ModalNuevaOrden from "@/components/ModalNuevaOrden";
import { listarClientesOpciones, listarEquiposOpciones } from "@/lib/cuentas/directorio";

export default async function TableroPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estatus?: string }>;
}) {
  const { q, estatus } = await searchParams;
  const busqueda = (q ?? "").trim().toLowerCase();
  const estatusActivo = (estatus ?? "").trim();

  const supabase = await createClient();
  const { perfil } = await perfilActual();
  // El Tablero del día a día siempre es "activas" — Concluido/Cancelado se
  // consultan desde Gerencia/histórico, no aquí.
  const [{ ordenes, error }, prefs] = await Promise.all([
    listarOrdenes(supabase, { soloActivos: true }),
    leerPreferencias(supabase, [
      "tablero_vista",
      "tablero_columnas_ocultas",
      "tablero_columnas_anchos",
    ]),
  ]);
  const vistaInicial = prefs.tablero_vista === "tarjetas" ? "tarjetas" : "tabla";
  // Preferencia guardada por el usuario, saneada por si acaso — nunca se
  // confía en la forma de lo que viene de la base de datos.
  const columnasOcultasIniciales = (
    Array.isArray(prefs.tablero_columnas_ocultas) ? prefs.tablero_columnas_ocultas : []
  ).filter((id): id is ColumnaTableroId =>
    (IDS_OCULTABLES as string[]).includes(String(id)),
  );
  const anchosCrudos =
    prefs.tablero_columnas_anchos && typeof prefs.tablero_columnas_anchos === "object"
      ? (prefs.tablero_columnas_anchos as Record<string, unknown>)
      : {};
  const columnasAnchosIniciales: Partial<Record<ColumnaTableroId, number>> = {};
  for (const [id, ancho] of Object.entries(anchosCrudos)) {
    if ((IDS_COLUMNAS_TABLERO as string[]).includes(id) && typeof ancho === "number") {
      columnasAnchosIniciales[id as ColumnaTableroId] = ancho;
    }
  }

  const esGerencia = esRolQueVeTodo(perfil.rol);

  // Ingenieros para asignar: los de la zona del coordinador, o todos si es
  // gerencia (la tabla los filtra por zona de cada orden).
  let consultaIng = supabase
    .from("ingenieros")
    .select("id, nombre, sucursal_id, zona_id")
    .eq("activo", true)
    .order("nombre");
  if (!esGerencia && perfil.zona_id) {
    consultaIng = consultaIng.eq("zona_id", perfil.zona_id);
  }
  const [{ data: ingenierosCrudos }, { data: marcas }, { data: sucursales }, clientes, equipos] =
    await Promise.all([
      consultaIng,
      supabase.from("marcas").select("id, nombre").order("nombre"),
      supabase
        .from("sucursales")
        .select("id, nombre, zona_id")
        .eq("activa", true)
        .order("nombre"),
      listarClientesOpciones(supabase),
      listarEquiposOpciones(supabase),
    ]);

  // `ingenieros.sucursal` (texto) ya no existe en la BD — solo sucursal_id.
  // El nombre se resuelve aquí contra `sucursales` (ya cargada arriba) en vez
  // de otro join, para que `IngenieroOpcion.sucursal` (string) siga
  // funcionando sin tocar los componentes que la consumen.
  const nombrePorSucursalId = new Map(
    (sucursales ?? []).map((s) => [s.id, s.nombre] as const),
  );
  const ingenieros = (ingenierosCrudos ?? []).map((i) => ({
    ...i,
    sucursal: i.sucursal_id ? (nombrePorSucursalId.get(i.sucursal_id) ?? null) : null,
  }));

  // Conteo por estatus (del conjunto cargado, antes de la búsqueda).
  const conteos = new Map<string, number>();
  for (const o of ordenes) {
    const e = String(o.estatus ?? "—");
    conteos.set(e, (conteos.get(e) ?? 0) + 1);
  }
  const chips = [...conteos.entries()].sort(
    (a, b) => prioridadDe(a[0]) - prioridadDe(b[0]),
  );

  const filtradas = ordenes
    .filter((o) => !estatusActivo || String(o.estatus ?? "") === estatusActivo)
    .filter(
      (o) =>
        !busqueda ||
        o.numero_orden.toLowerCase().includes(busqueda) ||
        (o.cliente ?? "").toLowerCase().includes(busqueda) ||
        (o.ingeniero_nombre ?? "").toLowerCase().includes(busqueda),
    );

  /** Preserva `q` al armar el href de un chip de estatus. */
  function hrefEstatus(e: string): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (e !== estatusActivo) params.set("estatus", e);
    const qs = params.toString();
    return qs ? `/tablero?${qs}` : "/tablero";
  }

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
            {busqueda || estatusActivo ? ` de ${ordenes.length}` : ""} órden
            {filtradas.length === 1 ? "" : "es"} activas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModalPegarWOSR />
          <ModalPegarXerox
            sucursales={(sucursales ?? []).filter(
              (s): s is { id: string; nombre: string; zona_id: string } =>
                !!s.zona_id,
            )}
            veTodo={esGerencia}
          />
          {perfil.zona_id && (
            <ModalNuevaOrden
              ingenieros={(ingenieros ?? []).filter(
                (i) => i.zona_id === perfil.zona_id,
              )}
              sucursales={(sucursales ?? []).filter(
                (s) => s.zona_id === perfil.zona_id,
              )}
              marcas={marcas ?? []}
              clientes={clientes}
              equipos={equipos}
            />
          )}
        </div>
      </div>

      {/* Fila 2: buscar + filtros, juntos */}
      <Revelar delay={40} className="mb-4 flex flex-wrap items-center gap-2">
        <form method="GET" className="relative flex items-center">
          {estatusActivo && <input type="hidden" name="estatus" value={estatusActivo} />}
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
        {chips.map(([estatus]) => (
          <Link
            key={estatus}
            href={hrefEstatus(estatus)}
            className={
              chip +
              " " +
              claseEstatus(estatus) +
              (estatusActivo === estatus
                ? " ring-2 ring-offset-1 ring-offset-surface ring-current"
                : "")
            }
          >
            {estatus}
          </Link>
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
            sucursales={sucursales ?? []}
            esGerencia={esGerencia}
            vistaInicial={vistaInicial}
            columnasOcultasIniciales={columnasOcultasIniciales}
            columnasAnchosIniciales={columnasAnchosIniciales}
          />
        </Revelar>
      )}
    </div>
  );
}
