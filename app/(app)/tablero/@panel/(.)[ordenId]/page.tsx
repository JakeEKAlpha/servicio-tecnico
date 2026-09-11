import { Suspense } from "react";
import DetalleOrdenCargado from "@/components/tablero/DetalleOrdenCargado";
import PanelDeslizanteRuta from "@/components/tablero/PanelDeslizanteRuta";

/**
 * Intercepta `/tablero/[ordenId]` cuando se navega ahí DESDE `/tablero`
 * (clic en una fila) y lo muestra como panel lateral en vez de cambiar de
 * página. Un refresh o un link directo cae en `[ordenId]/page.tsx` (página
 * completa) — Next no intercepta en navegación dura.
 */
export default async function PanelOrdenInterceptado({
  params,
}: {
  params: Promise<{ ordenId: string }>;
}) {
  const { ordenId } = await params;

  return (
    <PanelDeslizanteRuta titulo="Detalle de la orden">
      <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
        <DetalleOrdenCargado ordenId={ordenId} />
      </Suspense>
    </PanelDeslizanteRuta>
  );
}
