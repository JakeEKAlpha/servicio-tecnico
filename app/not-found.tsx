import Link from "next/link";
import IconoAD from "@/components/IconoAD";
import { boton } from "@/lib/ui";

/**
 * 404 con la identidad de la app — antes caía en la página genérica de
 * Next.js. Aplica a cualquier ruta inexistente o a un `notFound()` llamado
 * desde un server component (ej. una orden que ya no existe).
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <IconoAD className="h-14 w-auto text-brand" />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-extrabold text-text">No encontramos esta página</h1>
        <p className="max-w-sm text-sm text-muted">
          El enlace puede estar roto, o la orden ya no existe. Revisa la dirección o vuelve
          al Tablero.
        </p>
      </div>
      <Link href="/tablero" className={boton}>
        Ir al Tablero
      </Link>
    </div>
  );
}
