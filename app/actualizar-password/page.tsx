"use client";

import { useActionState } from "react";
import { actualizarPassword } from "./acciones";
import LogoAlpha from "@/components/LogoAlpha";
import { boton, campo } from "@/lib/ui";

export default function ActualizarPasswordPage() {
  const [estado, accion, pendiente] = useActionState(actualizarPassword, null);

  return (
    <main className="banda-marca flex min-h-screen flex-col items-center justify-center gap-5 p-4">
      <LogoAlpha variante="blanco" className="h-10 w-auto" />
      <form
        action={accion}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border-default bg-surface p-7 text-text shadow-xl"
      >
        <div>
          <h1 className="text-lg font-extrabold text-brand">Nueva contraseña</h1>
          <p className="text-sm text-muted">
            Elige una contraseña de al menos 8 caracteres.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-semibold">
            Contraseña nueva
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={campo}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmar" className="text-sm font-semibold">
            Repite la contraseña
          </label>
          <input
            id="confirmar"
            name="confirmar"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={campo}
          />
        </div>

        {estado?.error && (
          <p className="text-sm text-danger">{estado.error}</p>
        )}

        <button
          type="submit"
          disabled={pendiente}
          className={boton + " w-full"}
        >
          {pendiente ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </main>
  );
}
