import Link from "next/link";
import DetalleOrdenCargado from "@/components/tablero/DetalleOrdenCargado";

/**
 * Página completa de una orden — navegación directa, refresh o link
 * compartido. Desde el tablero, el mismo contenido se ve como panel lateral
 * sin salir de la lista (ver `@panel/(.)[ordenId]` en el layout de /tablero).
 */
export default async function DetalleOrdenPage({
  params,
}: {
  params: Promise<{ ordenId: string }>;
}) {
  const { ordenId } = await params;

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <Link
        href="/tablero"
        className="text-sm font-medium text-muted hover:text-brand"
      >
        ← Volver al tablero
      </Link>
      <div className="mt-4">
        <DetalleOrdenCargado ordenId={ordenId} />
      </div>
    </div>
  );
}
