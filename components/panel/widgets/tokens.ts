"use client";

import { useEffect, useState } from "react";

/**
 * Lee variables CSS del tema (`--brand`, `--muted`, …) y se vuelve a leer
 * cuando cambia `data-theme` o la preferencia del sistema. Sirve para dar
 * a Chart.js colores que siguen el modo claro/oscuro.
 */
export function useTokens(nombres: string[]): Record<string, string> {
  const clave = nombres.join(",");
  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    const leer = () => {
      const cs = getComputedStyle(document.documentElement);
      const next: Record<string, string> = {};
      for (const n of nombres) next[n] = cs.getPropertyValue(n).trim();
      setVals(next);
    };
    leer();

    const mo = new MutationObserver(leer);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", leer);

    return () => {
      mo.disconnect();
      mq.removeEventListener("change", leer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return vals;
}

/** Paleta categórica legible en claro y oscuro (tonos medios). */
export const PALETA = [
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#64748b",
  "#ec4899",
];
