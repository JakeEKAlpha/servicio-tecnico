import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import AlmacenPiezas, {
  type AlmacenSucursal,
  type PiezaAlmacen,
} from "@/components/AlmacenPiezas";

const ORDEN_CERRADA = new Set(["Concluido", "Cancelado"]);

export default async function AlmacenPage() {
  const supabase = await createClient();
  const { perfil } = await perfilActual();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esGerencia = esRolQueVeTodo(perfil.rol);
  const esEncargado = perfil.rol === "almacen";
  // Solo el encargado y gerencia editan; el coordinador/ingeniero solo consulta.
  const modo: "editar" | "ver" = esGerencia || esEncargado ? "editar" : "ver";

  // Qué sucursales ve cada rol
  let sucIds: string[] | null = null; // null = todas
  if (esEncargado && user) {
    const { data: enc } = await supabase
      .from("encargados_almacen")
      .select("sucursal_id")
      .eq("perfil_id", user.id);
    sucIds = (enc ?? []).map((e) => e.sucursal_id as string);
  } else if (!esGerencia) {
    // coordinador / ingeniero: sucursales de su zona
    const { data: sz } = await supabase
      .from("sucursales")
      .select("id")
      .eq("zona_id", perfil.zona_id ?? "");
    sucIds = (sz ?? []).map((s) => s.id as string);
  }

  let qSuc = supabase
    .from("sucursales")
    .select("id, nombre, ciudad, estado")
    .eq("activa", true)
    .order("nombre");
  if (sucIds) qSuc = qSuc.in("id", sucIds.length ? sucIds : ["-"]);
  const { data: sucRows } = await qSuc;

  const { data: invRows } = await supabase
    .from("inventario")
    .select(
      "id, numero_parte, sucursal_id, cantidad_disponible, cantidad_apartada, stock_minimo, ubicacion, piezas_catalogo(descripcion)",
    )
    .order("numero_parte");

  const { data: piezasRaw } = await supabase
    .from("piezas_orden")
    .select(
      "id, numero_parte, descripcion, estado, creada_en, recibida_en, ordenes(id, numero_orden, cliente, sucursal, estatus)",
    )
    .in("estado", ["en_espera", "recibida"])
    .order("creada_en", { ascending: true });

  type Almacen = AlmacenSucursal & { alias: string[] };
  const almacenes: Almacen[] = (sucRows ?? []).map((s) => ({
    id: s.id as string,
    sucursal: s.nombre as string,
    ciudad: (s.ciudad as string | null) ?? null,
    estado: (s.estado as string | null) ?? null,
    alias: [s.nombre as string, (s.ciudad as string | null) ?? ""].filter(
      Boolean,
    ),
    enEspera: [],
    enStock: [],
    stock: [],
  }));

  for (const r of invRows ?? []) {
    const dest = almacenes.find((a) => a.id === r.sucursal_id);
    if (!dest) continue;
    const catRaw = r.piezas_catalogo as unknown;
    const cat = (Array.isArray(catRaw) ? catRaw[0] : catRaw) as
      | { descripcion: string | null }
      | null
      | undefined;
    dest.stock.push({
      id: r.id as string,
      numero_parte: r.numero_parte as string,
      descripcion: cat?.descripcion ?? null,
      disponible: (r.cantidad_disponible as number) ?? 0,
      apartada: (r.cantidad_apartada as number) ?? 0,
      minimo: (r.stock_minimo as number) ?? 0,
      ubicacion: (r.ubicacion as string | null) ?? null,
    });
  }

  const otras: Almacen = {
    id: "__otras__",
    sucursal: "Sin sucursal / otras",
    ciudad: null,
    estado: null,
    alias: [],
    enEspera: [],
    enStock: [],
    stock: [],
  };

  for (const p of (piezasRaw ?? []) as Record<string, unknown>[]) {
    const o = p.ordenes as {
      id: string;
      numero_orden: string;
      cliente: string | null;
      sucursal: string | null;
      estatus: string | null;
    } | null;
    const pieza: PiezaAlmacen = {
      id: p.id as string,
      numero_parte: p.numero_parte as string,
      descripcion: (p.descripcion as string | null) ?? null,
      creada_en: p.creada_en as string,
      recibida_en: (p.recibida_en as string | null) ?? null,
      orden: o
        ? {
            id: o.id,
            numero_orden: o.numero_orden,
            cliente: o.cliente,
            estatus: o.estatus,
          }
        : null,
    };
    const suc = o?.sucursal?.trim() ?? "";
    const destino = almacenes.find((a) => a.alias.includes(suc)) ?? otras;
    if (p.estado === "en_espera") destino.enEspera.push(pieza);
    else if (p.estado === "recibida" && !ORDEN_CERRADA.has(String(o?.estatus)))
      destino.enStock.push(pieza);
  }

  const sinAlias = ({
    id,
    sucursal,
    ciudad,
    estado,
    enEspera,
    enStock,
    stock,
  }: Almacen): AlmacenSucursal => ({
    id,
    sucursal,
    ciudad,
    estado,
    enEspera,
    enStock,
    stock,
  });

  const lista = [
    ...almacenes.map(sinAlias),
    ...(otras.enEspera.length || otras.enStock.length ? [sinAlias(otras)] : []),
  ];

  let catalogo: { numero_parte: string; descripcion: string | null }[] = [];
  if (modo === "editar") {
    const { data } = await supabase
      .from("piezas_catalogo")
      .select("numero_parte, descripcion")
      .order("numero_parte");
    catalogo = (data ?? []) as typeof catalogo;
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-brand">
        {modo === "editar" ? "Almacenes" : "Consulta de stock"}
      </h1>
      <p className="mb-4 text-sm text-muted">
        {modo === "editar"
          ? "Stock por sucursal, entradas y salidas. Piezas pedidas para órdenes abajo."
          : "Piezas disponibles por sucursal de tu zona. Para movimientos de almacén contacta al encargado."}
      </p>
      <AlmacenPiezas
        almacenes={lista}
        catalogo={catalogo}
        modo={modo}
      />
    </div>
  );
}
