import type { NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return actualizarSesion(request);
}

export const config = {
  matcher: [
    /*
     * Todas las rutas menos:
     * - _next/static, _next/image (assets de Next)
     * - favicon.ico y archivos de imagen
     * (las rutas /api SÍ pasan por aquí, para refrescar la cookie de sesión,
     *  pero adentro no se redirigen — ver actualizarSesion)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
