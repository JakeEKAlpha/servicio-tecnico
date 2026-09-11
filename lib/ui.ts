/**
 * Clases compartidas de UI — identidad Alpha Digital.
 * Un solo lugar para el estilo de campos, botones, tarjetas y modales,
 * en vez de repetir la cadena en cada componente. Todo usa tokens
 * semánticos (bg-brand, border-default, text-muted…), nunca hex crudo.
 */

/** Estado de foco visible para teclado (Vercel Web Interface Guidelines). */
const foco =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/* --- Campos ---
 * Densidad del wireframe: controles de 34px, texto 13px, radio 8px. La
 * etiqueta de un campo es una micro-mayúscula (como Input/DetailField del
 * wireframe) — el VALOR o la acción va siempre en formato normal.
 */
export const campo =
  "w-full min-h-[34px] rounded-lg border border-border-default bg-surface px-[9px] text-[13px] font-medium text-text placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

export const etiqueta =
  "mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-muted";

/* --- Botones ---
 * Regla: la etiqueta es de UNA palabra (la acción, no la narración), en
 * formato normal — el mayúscula-siempre es solo para etiquetas de campo,
 * encabezados de tabla y de grupo, nunca para botones/pestañas/chips.
 * Deshabilitado NO se colorea: pierde el relleno de marca y queda gris —
 * así "puedo tocarlo" y "no puedo" se distinguen de un vistazo.
 */
const desactivado =
  "disabled:bg-surface-2 disabled:text-muted disabled:shadow-none disabled:cursor-not-allowed disabled:hover:bg-surface-2 disabled:active:scale-100";

export const boton =
  "inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg bg-brand px-[10px] text-[12px] font-extrabold text-brand-fg shadow-sm transition-[background-color,transform] duration-150 ease-out hover:bg-brand-600 active:scale-[0.98] " +
  desactivado + " " + foco;

export const botonSec =
  "inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-border-default bg-surface px-[10px] text-[12px] font-extrabold text-text transition-[background-color,transform] duration-150 ease-out hover:bg-surface-2 active:scale-[0.98] disabled:text-muted disabled:cursor-not-allowed disabled:hover:bg-surface disabled:active:scale-100 " +
  foco;

export const botonPeligro =
  "inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg bg-danger px-[10px] text-[12px] font-extrabold text-white shadow-sm transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:scale-[0.98] " +
  desactivado + " " + foco;

/** Botón chico de texto, para celdas de tabla / acciones inline. */
export const botonTexto =
  "rounded text-[12px] font-extrabold text-brand transition-colors duration-150 hover:text-brand-600 hover:underline disabled:opacity-40 " +
  foco;

/** Botón compacto (celdas de tabla): relleno azul, pequeño. */
export const botonMini =
  "inline-flex min-h-[28px] items-center gap-1 rounded-md bg-brand px-[9px] text-[11px] font-extrabold text-brand-fg transition-colors duration-150 hover:bg-brand-600 disabled:bg-surface-2 disabled:text-muted disabled:cursor-not-allowed disabled:hover:bg-surface-2 " +
  foco;

/** Botón compacto secundario. */
export const botonSecMini =
  "inline-flex min-h-[28px] items-center gap-1 rounded-md border border-border-default bg-surface px-[9px] text-[11px] font-extrabold text-text transition-colors duration-150 hover:bg-surface-2 disabled:opacity-40 " +
  foco;

/* --- Superficies ---
 * El wireframe usa tarjetas compactas (10px de relleno, radio ~9px) — no
 * las tarjetas grandes y aireadas de antes.
 */
export const tarjeta =
  "rounded-lg border border-border-default bg-surface p-[10px] shadow-sm transition-shadow duration-200 ease-out";

/** Tarjeta clicable: se levanta sutilmente al pasar el ratón. */
export const tarjetaInteractiva =
  "rounded-lg border border-border-default bg-surface p-[10px] shadow-sm transition-[transform,box-shadow,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md";

/** Encabezado de sección: raya de color + título en formato normal (nunca
 * mayúsculas — el wireframe reserva las mayúsculas para etiquetas, no
 * títulos). */
export const encabezadoSeccion =
  "mb-2.5 flex items-center gap-2 border-l-4 border-brand pl-2 text-[13px] font-extrabold text-text";

/** Etiqueta de grupo/categoría (riel, carril de kanban): sí en mayúsculas,
 * como las lanes del wireframe. */
export const etiquetaGrupo =
  "text-[10px] font-extrabold uppercase tracking-wide text-muted";

/* --- Chips / insignias --- */
export const chip =
  "inline-flex items-center rounded-full px-[7px] py-[3px] text-[10px] font-extrabold";

/* --- Modales ---
 * Compactos como el Modal del wireframe (relleno ~11px, radio ~10px,
 * ancho máx. 420px salvo que el llamador pida más).
 */
export const overlay =
  "anim-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand/30 backdrop-blur-sm p-4 py-10";

export const panel =
  "anim-modal-panel w-full space-y-3 rounded-xl border border-border-default bg-surface p-[14px] shadow-2xl";

/* --- Enlaces --- */
export const enlace = "rounded font-medium text-brand hover:underline " + foco;
