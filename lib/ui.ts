/**
 * Clases compartidas de UI — identidad Alpha Digital.
 * Un solo lugar para el estilo de campos, botones, tarjetas y modales,
 * en vez de repetir la cadena en cada componente. Todo usa tokens
 * semánticos (bg-brand, border-default, text-muted…), nunca hex crudo.
 */

/** Estado de foco visible para teclado (Vercel Web Interface Guidelines). */
const foco =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/* --- Campos --- */
export const campo =
  "w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

export const etiqueta = "block text-xs font-semibold text-muted";

/* --- Botones --- */
export const boton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg shadow-sm transition-[background-color,transform] duration-150 ease-out hover:bg-brand-600 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 " +
  foco;

export const botonSec =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-default bg-surface px-4 py-2 text-sm font-medium text-text transition-[background-color,transform] duration-150 ease-out hover:bg-surface-2 active:scale-[0.98] disabled:opacity-40 " +
  foco;

export const botonPeligro =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white shadow-sm transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:scale-[0.98] disabled:opacity-40 " +
  foco;

/** Botón chico de texto, para celdas de tabla / acciones inline. */
export const botonTexto =
  "rounded text-xs font-semibold text-brand transition-colors duration-150 hover:text-brand-600 hover:underline disabled:opacity-40 " +
  foco;

/** Botón compacto (celdas de tabla): relleno azul, pequeño. */
export const botonMini =
  "inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-xs font-semibold text-brand-fg transition-colors duration-150 hover:bg-brand-600 disabled:opacity-40 " +
  foco;

/** Botón compacto secundario. */
export const botonSecMini =
  "inline-flex items-center gap-1 rounded-md border border-border-default bg-surface px-2 py-1 text-xs font-medium text-text transition-colors duration-150 hover:bg-surface-2 disabled:opacity-40 " +
  foco;

/* --- Superficies --- */
export const tarjeta =
  "rounded-xl border border-border-default bg-surface p-5 shadow-sm transition-shadow duration-200 ease-out";

/** Tarjeta clicable: se levanta sutilmente al pasar el ratón. */
export const tarjetaInteractiva =
  "rounded-xl border border-border-default bg-surface p-4 shadow-sm transition-[transform,box-shadow,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md";

/** Encabezado de sección: raya azul + título. */
export const encabezadoSeccion =
  "mb-3 flex items-center gap-2 border-l-4 border-brand pl-2 text-sm font-bold text-text";

/* --- Chips / insignias --- */
export const chip =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

/* --- Modales --- */
export const overlay =
  "anim-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand/30 backdrop-blur-sm p-4 py-10";

export const panel =
  "anim-modal-panel w-full space-y-4 rounded-2xl border border-border-default bg-surface p-6 shadow-2xl";

/* --- Enlaces --- */
export const enlace = "rounded font-medium text-brand hover:underline " + foco;
