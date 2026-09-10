"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoLogin = { error: string } | null;
export type EstadoRecuperar = { ok: string } | { error: string } | null;

export async function iniciarSesion(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Escribe tu correo y tu contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/tablero");
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function recuperarPassword(
  _prev: EstadoRecuperar,
  formData: FormData,
): Promise<EstadoRecuperar> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Escribe tu correo." };
  }

  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("host") ? `https://${h.get("host")}` : "http://localhost:3000");

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/actualizar-password`,
  });

  // Respuesta genérica siempre (para no revelar qué correos existen).
  return {
    ok: "Si el correo está registrado, te enviamos un enlace para restablecer la contraseña. Revisa tu bandeja y el spam.",
  };
}
