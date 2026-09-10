/**
 * Catálogo de widgets del panel de inicio.
 *
 * Solo metadatos (id, título, tamaños, roles). Los componentes reales viven en
 * `components/panel/widgets/` y `Panel.tsx` los mapea por id — así este archivo
 * lo puede importar el servidor sin arrastrar código de cliente.
 */

export type RolPanel = "coordinador" | "gerencia" | "admin" | "almacen";

export type WidgetDef = {
  id: string;
  titulo: string;
  /** Tamaño por defecto en unidades de rejilla `lg` (12 columnas). */
  def: { w: number; h: number };
  /** Tamaño mínimo al redimensionar. */
  min: { w: number; h: number };
  /** Roles que pueden ver el widget. */
  roles: RolPanel[];
};

const COORD: RolPanel[] = ["coordinador", "gerencia", "admin"];
const TODOS: RolPanel[] = ["coordinador", "gerencia", "admin", "almacen"];

export const CATALOGO: WidgetDef[] = [
  { id: "filtros", titulo: "Filtros rápidos", def: { w: 12, h: 2 }, min: { w: 6, h: 1 }, roles: COORD },
  { id: "alertas", titulo: "Alertas críticas", def: { w: 12, h: 3 }, min: { w: 6, h: 2 }, roles: TODOS },
  { id: "kpi_activas", titulo: "Órdenes activas", def: { w: 3, h: 2 }, min: { w: 2, h: 2 }, roles: COORD },
  { id: "kpi_sin_asignar", titulo: "Sin asignar", def: { w: 3, h: 2 }, min: { w: 2, h: 2 }, roles: COORD },
  { id: "kpi_hoy", titulo: "Para hoy", def: { w: 3, h: 2 }, min: { w: 2, h: 2 }, roles: COORD },
  { id: "kpi_eta", titulo: "Cumplimiento de ETA", def: { w: 3, h: 2 }, min: { w: 3, h: 2 }, roles: COORD },
  { id: "flujo", titulo: "Flujo semanal", def: { w: 6, h: 3 }, min: { w: 4, h: 3 }, roles: COORD },
  { id: "fases", titulo: "Distribución por fase", def: { w: 6, h: 3 }, min: { w: 4, h: 3 }, roles: TODOS },
  { id: "pendientes", titulo: "Órdenes por asignar", def: { w: 6, h: 4 }, min: { w: 4, h: 3 }, roles: COORD },
  { id: "agenda", titulo: "Agenda de hoy", def: { w: 4, h: 3 }, min: { w: 3, h: 2 }, roles: COORD },
  { id: "accesos", titulo: "Accesos rápidos", def: { w: 4, h: 2 }, min: { w: 3, h: 2 }, roles: TODOS },
  { id: "alm_validar", titulo: "Piezas por validar", def: { w: 3, h: 2 }, min: { w: 2, h: 2 }, roles: ["almacen"] },
  { id: "alm_minimo", titulo: "Bajo mínimo", def: { w: 3, h: 2 }, min: { w: 2, h: 2 }, roles: ["almacen"] },
  { id: "alm_arribos", titulo: "Arribos pendientes", def: { w: 3, h: 2 }, min: { w: 2, h: 2 }, roles: ["almacen"] },
];

const POR_ID = new Map(CATALOGO.map((w) => [w.id, w]));

export function widgetDef(id: string): WidgetDef | undefined {
  return POR_ID.get(id);
}

/** ¿Este rol puede ver este widget? */
export function rolPuedeVer(id: string, rol: string): boolean {
  const w = POR_ID.get(id);
  return !!w && (w.roles as string[]).includes(rol);
}

/** Widgets disponibles para un rol, en el orden del catálogo. */
export function widgetsDeRol(rol: string): WidgetDef[] {
  return CATALOGO.filter((w) => (w.roles as string[]).includes(rol));
}

/**
 * Orden de aparición por defecto. El empaquetado (x/y) lo calcula `layout.ts`.
 */
export const ORDEN_DEFECTO: Record<"coord" | "almacen", string[]> = {
  coord: [
    "filtros",
    "alertas",
    "kpi_activas",
    "kpi_sin_asignar",
    "kpi_hoy",
    "kpi_eta",
    "flujo",
    "fases",
    "pendientes",
    "agenda",
    "accesos",
  ],
  almacen: ["alertas", "alm_validar", "alm_minimo", "alm_arribos", "fases", "accesos"],
};
