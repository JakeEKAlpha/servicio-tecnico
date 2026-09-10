import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada request y decide redirecciones de
 * autenticación. Se llama desde `proxy.ts` (la raíz).
 *
 * Patrón oficial de Supabase para Next.js: crear un cliente de servidor con
 * las cookies del request/response, llamar a `getUser()` para forzar el
 * refresco del token, y devolver la respuesta con las cookies actualizadas.
 */
export async function actualizarSesion(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Sin config no podemos validar sesión; dejamos pasar y que cada endpoint
    // o página falle con su propio mensaje.
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANTE: esto refresca el token si hace falta.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const esRutaPublica = path === "/login" || path.startsWith("/auth");
  const esApi = path.startsWith("/api");

  // Sin sesión en una página protegida -> a /login.
  // Las rutas /api devuelven su propio 401, no se redirigen.
  if (!user && !esRutaPublica && !esApi) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  // Con sesión y en /login -> al tablero.
  if (user && path === "/login") {
    const destino = request.nextUrl.clone();
    destino.pathname = "/tablero";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return response;
}
