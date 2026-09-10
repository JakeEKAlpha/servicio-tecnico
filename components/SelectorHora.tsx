"use client";

import { useEffect, useState } from "react";
import { parseHoraEta, fmtHora } from "@/lib/horas";

const horaCls =
  "min-w-0 flex-1 rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-50";

/** "14:00" -> "2:00 p. m." (formato que espera el documento / Sheets). */
function a12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const suf = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, "0")} ${suf}`;
}

/** Compone el texto de `hora_eta`. Con `fin` vacío → hora exacta. */
export function construirRangoHora(inicio: string, fin: string): string {
  if (!inicio) return "";
  return fin ? `${a12(inicio)} - ${a12(fin)}` : a12(inicio);
}

/** Suma horas a "HH:MM" (24 h), tope 23:45. */
function sumar(hhmm: string, horas: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  let total = h * 60 + m + horas * 60;
  total = Math.min(total, 23 * 60 + 45);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

type Modo = "exacta" | "intervalo";

/**
 * Selector de "hora ETA". El coordinador elige entre **hora exacta** o
 * **intervalo** (inicio–fin); la preferencia se recuerda en el dispositivo.
 */
export default function SelectorHora({
  valor,
  onCambio,
  disabled,
}: {
  valor: string;
  onCambio: (texto: string) => void;
  disabled?: boolean;
}) {
  const r = parseHoraEta(valor);
  const [inicio, setInicio] = useState(r ? fmtHora(r.inicio) : "");
  const [fin, setFin] = useState(r?.fin != null ? fmtHora(r.fin) : "");
  const [modo, setModo] = useState<Modo>(r?.fin != null ? "intervalo" : "exacta");

  // Si no había valor previo, usa la preferencia guardada.
  useEffect(() => {
    if (valor) return;
    try {
      const pref = localStorage.getItem("eta_modo");
      if (pref === "exacta" || pref === "intervalo") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setModo(pref);
      }
    } catch {
      /* noop */
    }
  }, [valor]);

  function cambiarModo(m: Modo) {
    setModo(m);
    try {
      localStorage.setItem("eta_modo", m);
    } catch {
      /* noop */
    }
    if (m === "exacta") {
      setFin("");
      onCambio(construirRangoHora(inicio, ""));
    } else if (inicio) {
      const nuevoFin = fin || sumar(inicio, 1);
      setFin(nuevoFin);
      onCambio(construirRangoHora(inicio, nuevoFin));
    }
  }

  function cambiarInicio(nuevo: string) {
    setInicio(nuevo);
    if (modo === "exacta") {
      onCambio(construirRangoHora(nuevo, ""));
      return;
    }
    const nuevoFin = fin || (nuevo ? sumar(nuevo, 1) : "");
    if (!fin) setFin(nuevoFin);
    onCambio(construirRangoHora(nuevo, nuevoFin));
  }

  function cambiarFin(nuevo: string) {
    setFin(nuevo);
    onCambio(construirRangoHora(inicio, nuevo));
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Tipo de hora"
        className="mb-1.5 inline-flex gap-1 rounded-lg bg-surface-2 p-0.5"
      >
        {(["exacta", "intervalo"] as Modo[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={modo === m}
            disabled={disabled}
            onClick={() => cambiarModo(m)}
            className={
              "rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors " +
              (modo === m
                ? "bg-surface text-text shadow-sm"
                : "text-muted hover:text-text")
            }
          >
            {m === "exacta" ? "Hora exacta" : "Intervalo"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="time"
          value={inicio}
          onChange={(e) => cambiarInicio(e.target.value)}
          disabled={disabled}
          className={horaCls}
          aria-label={modo === "exacta" ? "Hora" : "Hora de inicio"}
        />
        {modo === "intervalo" && (
          <>
            <span className="text-muted">a</span>
            <input
              type="time"
              value={fin}
              onChange={(e) => cambiarFin(e.target.value)}
              disabled={disabled}
              className={horaCls}
              aria-label="Hora de fin"
            />
          </>
        )}
      </div>

      {inicio && (
        <p className="mt-1 text-xs text-muted">
          Se guardará como: {construirRangoHora(inicio, modo === "exacta" ? "" : fin)}
        </p>
      )}
    </div>
  );
}
