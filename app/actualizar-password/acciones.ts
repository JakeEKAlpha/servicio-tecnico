"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoPassword = { error: string } | null;

export async function actualizarPassword(
  _prev: EstadoPassword,
  formData: FormData,
): Promise<EstadoPassword> {
  const password = String(formData.get("password") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmar) {
    return { error: "Las dos contraseñas no coinciden." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  // Baja la bandera "debe cambiar contraseña" (si estaba puesta).
  await supabase.rpc("password_cambiada");

  redirect("/tablero");
}
