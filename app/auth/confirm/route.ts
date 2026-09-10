import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Punto de aterrizaje de los enlaces de correo de Supabase (recuperar
 * contraseña, invitación, confirmación de email).
 *
 * Soporta el flujo PKCE (`?code=`) y el de token_hash (`?token_hash=&type=`).
 * Al validar, deja la sesión en cookies y redirige a `next`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/tablero";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  }

  redirect("/login?error=enlace_invalido");
}
