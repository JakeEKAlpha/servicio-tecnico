"use client";

import { useEffect } from "react";
import Link from "next/link";
import IconoAD from "@/components/IconoAD";
import { boton, botonSec } from "@/lib/ui";
import { Alerta } from "@/lib/iconos";

/**
 * Límite de error global — antes de esto, cualquier excepción sin capturar
 * mostraba la pantalla genérica de Next.js (sin marca, sin salida clara).
 * Mismo lenguaje visual que `loading.tsx` (azul Alpha, monograma) para que
 * un error se sienta "parte de lo mismo" en vez de una pantalla rota.
 */
export default function ErrorGlobal({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <IconoAD className="h-14 w-auto text-brand" />
      <div className="flex flex-col items-center gap-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tone-rojo-bg text-tone-rojo-fg">
          <Alerta className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-extrabold text-text">Algo salió mal</h1>
        <p className="max-w-sm text-sm text-muted">
          No pudimos cargar esta pantalla. Puedes intentar de nuevo — si sigue pasando,
          avísale a coordinación.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={reset} className={boton}>
          Reintentar
        </button>
        <Link href="/tablero" className={botonSec}>
          Ir al Tablero
        </Link>
      </div>
    </div>
  );
}
