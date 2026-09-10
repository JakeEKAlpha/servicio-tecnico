/**
 * Tipos y utilidades del layout del panel de inicio.
 *
 * El layout se guarda en `preferencias_usuario` (clave `panel_layout`) como
 * `PanelLayout`. `mergeLayout` tolera versiones viejas: agrega widgets nuevos
 * del catálogo, descarta ids que ya no existen o que el rol no puede ver.
 */

import {
  ORDEN_DEFECTO,
  widgetDef,
  rolPuedeVer,
  type WidgetDef,
} from "@/lib/panel/catalogo";

export type LayoutItem = { i: string; x: number; y: number; w: number; h: number };
export type PanelLayout = {
  lg: LayoutItem[];
  md: LayoutItem[];
  sm: LayoutItem[];
  ocultos: string[];
};

export const COLS = { lg: 12, md: 8, sm: 1 } as const;
export const BREAKPOINTS = { lg: 1024, md: 768, sm: 0 } as const;

/** Empaqueta una lista ordenada de widgets en `cols` columnas (shelf packing). */
function empaquetar(ids: string[], cols: number): LayoutItem[] {
  const out: LayoutItem[] = [];
  let x = 0;
  let y = 0;
  let altoFila = 0;
  for (const id of ids) {
    const d = widgetDef(id);
    if (!d) continue;
    const w = Math.min(d.def.w, cols);
    const h = d.def.h;
    if (x + w > cols) {
      x = 0;
      y += altoFila;
      altoFila = 0;
    }
    out.push({ i: id, x, y, w, h });
    x += w;
    altoFila = Math.max(altoFila, h);
  }
  return out;
}

function ordenDeRol(rol: string): string[] {
  return rol === "almacen" ? ORDEN_DEFECTO.almacen : ORDEN_DEFECTO.coord;
}

/** Layout por defecto para un rol, en los tres breakpoints. */
export function layoutPorDefecto(rol: string): PanelLayout {
  const ids = ordenDeRol(rol);
  return {
    lg: empaquetar(ids, COLS.lg),
    md: empaquetar(ids, COLS.md),
    sm: empaquetar(ids, COLS.sm),
    ocultos: [],
  };
}

function esItem(v: unknown): v is LayoutItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.i === "string" &&
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.w === "number" &&
    typeof o.h === "number"
  );
}

/** Ancho válido: respeta el mínimo del widget pero nunca pasa de las columnas. */
function anchoValido(w: number, min: number, cols: number): number {
  return Math.min(Math.max(min, w), cols);
}

/** Ajusta un item a los límites del catálogo y del ancho de columnas. */
function sanearItem(it: LayoutItem, def: WidgetDef, cols: number): LayoutItem {
  const w = anchoValido(it.w, def.min.w, cols);
  const h = Math.max(def.min.h, it.h);
  const x = Math.max(0, Math.min(it.x, cols - w));
  const y = Math.max(0, it.y);
  return { i: it.i, x, y, w, h };
}

function mergeBreakpoint(
  guardado: unknown,
  rol: string,
  cols: number,
  base: LayoutItem[],
): LayoutItem[] {
  const guardados = Array.isArray(guardado) ? guardado.filter(esItem) : [];
  const porId = new Map(guardados.map((g) => [g.i, g]));
  return base.map((b) => {
    const def = widgetDef(b.i)!;
    const g = porId.get(b.i);
    if (g && rolPuedeVer(b.i, rol)) return sanearItem(g, def, cols);
    return b;
  });
}

/**
 * Combina el layout guardado con el default del rol.
 * - Widgets nuevos del catálogo aparecen en su posición default.
 * - Ids desconocidos o no permitidos por el rol se ignoran.
 * - `ocultos` se filtra a ids válidos para el rol.
 */
export function mergeLayout(guardado: unknown, rol: string): PanelLayout {
  const base = layoutPorDefecto(rol);
  const g = (guardado ?? {}) as Partial<PanelLayout>;

  const ocultos = Array.isArray(g.ocultos)
    ? g.ocultos.filter(
        (id): id is string => typeof id === "string" && rolPuedeVer(id, rol),
      )
    : [];

  return {
    lg: mergeBreakpoint(g.lg, rol, COLS.lg, base.lg),
    md: mergeBreakpoint(g.md, rol, COLS.md, base.md),
    sm: mergeBreakpoint(g.sm, rol, COLS.sm, base.sm),
    ocultos,
  };
}

/** Inserta un widget (que estaba oculto o nunca colocado) al final de cada breakpoint. */
export function agregarWidget(layout: PanelLayout, id: string): PanelLayout {
  const def = widgetDef(id);
  if (!def) return layout;
  const alFinal = (items: LayoutItem[], cols: number): LayoutItem[] => {
    if (items.some((it) => it.i === id)) return items;
    const maxY = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
    return [...items, { i: id, x: 0, y: maxY, w: Math.min(def.def.w, cols), h: def.def.h }];
  };
  return {
    lg: alFinal(layout.lg, COLS.lg),
    md: alFinal(layout.md, COLS.md),
    sm: alFinal(layout.sm, COLS.sm),
    ocultos: layout.ocultos.filter((o) => o !== id),
  };
}

/** Marca un widget como oculto (no se borra de los layouts, solo no se pinta). */
export function quitarWidget(layout: PanelLayout, id: string): PanelLayout {
  return {
    ...layout,
    ocultos: layout.ocultos.includes(id) ? layout.ocultos : [...layout.ocultos, id],
  };
}

/** Cambia el tamaño de un widget en los tres breakpoints (respetando mínimos y columnas). */
export function redimensionar(
  layout: PanelLayout,
  id: string,
  w: number,
  h: number,
): PanelLayout {
  const def = widgetDef(id);
  if (!def) return layout;
  const aplica = (items: LayoutItem[], cols: number): LayoutItem[] =>
    items.map((it) => {
      if (it.i !== id) return it;
      const nw = anchoValido(w, def.min.w, cols);
      return {
        ...it,
        w: nw,
        h: Math.max(def.min.h, h),
        x: Math.max(0, Math.min(it.x, cols - nw)),
      };
    });
  return {
    lg: aplica(layout.lg, COLS.lg),
    md: aplica(layout.md, COLS.md),
    sm: aplica(layout.sm, COLS.sm),
    ocultos: layout.ocultos,
  };
}
