"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renderiza el contenido al final de <body>, fuera de cualquier ancestro con
 * `transform`/`overflow` (tarjetas animadas, contenedores con scroll). Es la
 * forma correcta de montar modales y hojas para que `position: fixed` se
 * posicione respecto a la ventana y no quede recortado.
 */
export default function Portal({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMontado(true);
  }, []);
  if (!montado) return null;
  return createPortal(children, document.body);
}
