/**
 * Mapeo estatus → "tono" visual. Los colores reales viven en `globals.css`
 * como tokens theme-aware; aquí solo se devuelven clases de Tailwind.
 */

type Tono =
  | "info"
  | "warn"
  | "ok"
  | "violet"
  | "orange"
  | "teal"
  | "neutral";

const CLASE_TONO: Record<Tono, string> = {
  info: "bg-tone-info-bg text-tone-info-fg",
  warn: "bg-tone-warn-bg text-tone-warn-fg",
  ok: "bg-tone-ok-bg text-tone-ok-fg",
  violet: "bg-tone-violet-bg text-tone-violet-fg",
  orange: "bg-tone-orange-bg text-tone-orange-fg",
  teal: "bg-tone-teal-bg text-tone-teal-fg",
  neutral: "bg-tone-neutral-bg text-tone-neutral-fg",
};

const TONO_ESTATUS: Record<string, Tono> = {
  Nuevo: "info",
  Pendiente: "warn",
  Asignado: "ok",
  Reagendado: "violet",
  "Pendiente por partes": "orange",
  "Lista para realizar": "teal",
  "Listo para continuar": "teal",
  Concluido: "neutral",
  Cancelado: "neutral",
};

const TONO_PIEZA: Record<string, Tono> = {
  recomendada: "info",
  en_espera: "warn",
  recibida: "ok",
  apartada: "violet",
  usada: "teal",
  cancelada: "neutral",
};

const PUNTO_TONO: Record<Tono, string> = {
  info: "bg-sky-400",
  warn: "bg-amber-400",
  ok: "bg-emerald-400",
  violet: "bg-violet-400",
  orange: "bg-orange-400",
  teal: "bg-teal-400",
  neutral: "bg-slate-400",
};

/** Color sólido para el "punto" indicador de estatus (ej. en la ficha). */
export function puntoEstatus(estatus: string | null | undefined): string {
  return PUNTO_TONO[TONO_ESTATUS[String(estatus ?? "").trim()] ?? "neutral"];
}

/** Clases de fondo+texto para un chip de estatus de orden. */
export function claseEstatus(estatus: string | null | undefined): string {
  return CLASE_TONO[TONO_ESTATUS[String(estatus ?? "").trim()] ?? "neutral"];
}

/** Clases de fondo+texto para un chip de estado de pieza. */
export function claseEstadoPieza(estado: string | null | undefined): string {
  return CLASE_TONO[TONO_PIEZA[String(estado ?? "").trim()] ?? "neutral"];
}

/**
 * Color de una orden por marca / tipo, para las barras del Gantt y acentos.
 * Regla del negocio:
 *   WO (Lexmark work order)   → verde Lexmark
 *   SR / proactiva (Lexmark)  → ámbar (variante de Lexmark)
 *   Xerox                     → rojo Xerox
 *   Alpha / otras             → azul Alpha
 * Devuelve `{ barra, texto, punto }`: clases para la barra rellena, el color
 * de texto legible encima, y un color sólido para puntos/bordes de acento.
 */
export function colorOrden(
  origen: string | null | undefined,
  marca?: string | null,
): { barra: string; texto: string; punto: string } {
  const m = String(marca ?? "").toLowerCase();
  const o = String(origen ?? "").toUpperCase();

  if (m.includes("xerox")) {
    return {
      barra: "bg-marca-xerox",
      texto: "text-white",
      punto: "bg-marca-xerox",
    };
  }
  if (o === "SR") {
    return {
      barra: "bg-marca-lexmark-sr",
      texto: "text-amber-950",
      punto: "bg-marca-lexmark-sr",
    };
  }
  if (o === "WO" || m.includes("lexmark")) {
    return {
      barra: "bg-marca-lexmark",
      texto: "text-white",
      punto: "bg-marca-lexmark",
    };
  }
  return { barra: "bg-marca-alpha", texto: "text-white", punto: "bg-marca-alpha" };
}
