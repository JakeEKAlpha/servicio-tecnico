"use client";

import { useRouter } from "next/navigation";
import PanelDeslizante from "@/components/tablero/PanelDeslizante";

/** `PanelDeslizante` atado a la ruta: cerrarlo hace `router.back()`. */
export default function PanelDeslizanteRuta({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <PanelDeslizante titulo={titulo} onCerrar={() => router.back()}>
      {children}
    </PanelDeslizante>
  );
}
