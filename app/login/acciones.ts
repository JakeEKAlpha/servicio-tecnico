"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { excedeLimite, ipDeLaPeticion } from "@/lib/rateLimit";

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

  // Defensa en profundidad: Supabase Auth ya limita intentos por su lado,
  // esto es una segunda capa barata. 8 intentos / 5 min por IP.
  const ip = await ipDeLaPeticion();
  if (excedeLimite(`login:${ip}`, 8, 5 * 60_000)) {
    return { error: "Demasiados intentos. Espera unos minutos e inténtalo otra vez." };
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

  // Cada envío manda un correo real (cuota compartida del proyecto de
  // Supabase) — 3 / 15 min por IP, para que no se agote por spam al form.
  const ip = await ipDeLaPeticion();
  if (excedeLimite(`recuperar:${ip}`, 3, 15 * 60_000)) {
    return {
      ok:
        "Si el correo está registrado, te enviamos un enlace para restablecer la contraseña. Revisa tu bandeja y el spam.",
    };
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
