"use client";

import { useEffect } from "react";

/**
 * Solo se dispara si el propio `app/layout.tsx` truena (caso raro) — a
 * diferencia de `error.tsx`, tiene que traer su propio `<html>/<body>`
 * porque reemplaza el layout entero. Minimal a propósito: si el layout
 * falló, no hay garantía de que fuentes/tokens carguen tampoco.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "system-ui, sans-serif",
          background: "#f4f6f9",
          color: "#1e293b",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Algo salió mal</h1>
        <p style={{ fontSize: 14, color: "#64748b", maxWidth: 360 }}>
          No pudimos cargar Servicio Técnico. Intenta de nuevo.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: "#203f7e",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
