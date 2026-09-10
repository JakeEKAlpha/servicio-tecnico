import type { SupabaseClient } from "@supabase/supabase-js";
import type { Perfil } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { hoyMx } from "@/lib/fechas";
import type { Tono } from "@/lib/tema";

export type Kpi = {
  etiqueta: string;
  valor: number | string;
  tono?: Tono;
  href?: string;
};
export type Pendiente = { titulo: string; detalle: string; href: string };
export type Acceso = { label: string; href: string; d: string };
export type AgendaFila = { ingeniero: string; visitas: number };

export type ResumenInicio = {
  contexto: string;
  kpis: Kpi[];
  pendientesTitulo: string;
  pendientes: Pendiente[];
  accesos: Acceso[];
  agendaHoy: AgendaFila[];
};

const CERRADAS = "(Concluido,Cancelado)";

const IC = {
  tablero: "M4 5h16M4 12h16M4 19h10",
  agenda: "M5 4h14v16H5zM5 9h14M9 4v16",
  almacen: "M3 9l9-6 9 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  gerencia: "M4 21V10l8-6 8 6v11H4zM10 21v-6h4v6",
};

/** Resumen de bienvenida — mismos bloques para todos, distinta consulta por rol. */
export async function resumenInicio(
  supabase: SupabaseClient,
  perfil: Perfil,
): Promise<ResumenInicio> {
  const hoy = hoyMx();
  const hace30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const veTodo = esRolQueVeTodo(perfil.rol);

  // ---------- Encargado de almacén ----------
  if (perfil.rol === "almacen") {
    const [pv, ee, inv, mh, pend] = await Promise.all([
      supabase
        .from("piezas_orden")
        .select("id", { count: "exact", head: true })
        .eq("estado", "en_espera")
        .eq("validada_almacen", false),
      supabase
        .from("piezas_orden")
        .select("id", { count: "exact", head: true })
        .eq("estado", "en_espera"),
      supabase.from("inventario").select("cantidad_disponible, stock_minimo"),
      supabase
        .from("movimientos_inventario")
        .select("id", { count: "exact", head: true })
        .gte("creado_en", `${hoy}T00:00:00`),
      supabase
        .from("piezas_orden")
        .select("numero_parte, orden_id, validada_almacen")
        .eq("estado", "en_espera")
        .order("creada_en", { ascending: true })
        .limit(8),
    ]);

    const bajoStock = (inv.data ?? []).filter(
      (r) =>
        (r.stock_minimo ?? 0) > 0 &&
        (r.cantidad_disponible ?? 0) <= (r.stock_minimo ?? 0),
    ).length;

    return {
      contexto: "Almacén",
      kpis: [
        {
          etiqueta: "Piezas por validar",
          valor: pv.count ?? 0,
          tono: (pv.count ?? 0) > 0 ? "warn" : "ok",
          href: "/almacen",
        },
        { etiqueta: "Arribos pendientes", valor: ee.count ?? 0, href: "/almacen" },
        {
          etiqueta: "Bajo mínimo",
          valor: bajoStock,
          tono: bajoStock > 0 ? "warn" : "ok",
          href: "/almacen",
        },
        { etiqueta: "Movimientos hoy", valor: mh.count ?? 0, href: "/almacen" },
      ],
      pendientesTitulo: "Piezas pedidas por atender",
      pendientes: (pend.data ?? []).map((p) => ({
        titulo: p.numero_parte as string,
        detalle: p.validada_almacen
          ? "Validada · falta confirmar arribo"
          : "Falta validar existencia física",
        href: `/tablero/${p.orden_id}`,
      })),
      accesos: [{ label: "Almacén", href: "/almacen", d: IC.almacen }],
      agendaHoy: [],
    };
  }

  // ---------- Coordinador / Gerencia / Admin ----------
  // Coordinador: solo su zona. Gerencia/admin: match vacío = todas.
  const zona: Record<string, string> =
    !veTodo && perfil.zona_id ? { zona_id: perfil.zona_id } : {};

  const [activas, sinAsignar, paraHoy, cerradas30, porAsignar, agendaRaw] =
    await Promise.all([
      supabase
        .from("ordenes")
        .select("id", { count: "exact", head: true })
        .match(zona)
        .not("estatus", "in", CERRADAS),
      supabase
        .from("ordenes")
        .select("id", { count: "exact", head: true })
        .match(zona)
        .not("estatus", "in", CERRADAS)
        .is("ingeniero_id", null),
      supabase
        .from("ordenes")
        .select("id", { count: "exact", head: true })
        .match(zona)
        .not("estatus", "in", CERRADAS)
        .eq("fecha_eta", hoy),
      supabase
        .from("ordenes")
        .select("id", { count: "exact", head: true })
        .match(zona)
        .eq("estatus", "Concluido")
        .gte("actualizado_en", hace30),
      supabase
        .from("ordenes")
        .select("id, numero_orden, cliente, localidad, estado, fecha_eta")
        .match(zona)
        .not("estatus", "in", CERRADAS)
        .is("ingeniero_id", null)
        .order("fecha_eta", { ascending: true, nullsFirst: true })
        .limit(8),
      supabase
        .from("ordenes")
        .select("ingenieros(nombre)")
        .match(zona)
        .eq("fecha_eta", hoy)
        .not("estatus", "in", CERRADAS)
        .not("ingeniero_id", "is", null),
    ]);

  const porIng = new Map<string, number>();
  for (const r of agendaRaw.data ?? []) {
    const rel = (r as { ingenieros: unknown }).ingenieros;
    const nombre =
      ((Array.isArray(rel) ? rel[0] : rel) as { nombre?: string })?.nombre ??
      "Sin nombre";
    porIng.set(nombre, (porIng.get(nombre) ?? 0) + 1);
  }
  const agendaHoy = [...porIng.entries()]
    .map(([ingeniero, visitas]) => ({ ingeniero, visitas }))
    .sort((a, b) => b.visitas - a.visitas);

  const accesos: Acceso[] = [
    { label: "Tablero", href: "/tablero", d: IC.tablero },
    { label: "Agenda del día", href: "/tablero-dias", d: IC.agenda },
    { label: "Almacén", href: "/almacen", d: IC.almacen },
  ];
  if (veTodo) accesos.push({ label: "Gerencia", href: "/gerencia", d: IC.gerencia });

  const nAsignar = sinAsignar.count ?? 0;

  return {
    contexto: veTodo
      ? "Todas las zonas"
      : perfil.zona_nombre ?? "Sin zona asignada",
    kpis: [
      { etiqueta: "Órdenes activas", valor: activas.count ?? 0, href: "/tablero?activos=1" },
      {
        etiqueta: "Sin asignar",
        valor: nAsignar,
        tono: nAsignar > 0 ? "warn" : "ok",
        href: "/tablero?activos=1",
      },
      { etiqueta: "Para hoy", valor: paraHoy.count ?? 0, href: "/tablero-dias" },
      { etiqueta: "Concluidas (30 d)", valor: cerradas30.count ?? 0, tono: "ok" },
    ],
    pendientesTitulo: "Órdenes por asignar",
    pendientes: (porAsignar.data ?? []).map((o) => ({
      titulo: `${o.numero_orden} · ${o.cliente ?? "—"}`,
      detalle:
        ([o.localidad, o.estado].filter(Boolean).join(", ") || "Sin ubicación") +
        (o.fecha_eta ? ` · ETA ${o.fecha_eta}` : " · sin fecha"),
      href: `/tablero/${o.id}`,
    })),
    accesos,
    agendaHoy,
  };
}
