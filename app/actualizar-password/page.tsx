"use client";

import { useActionState, useState } from "react";
import { actualizarPassword } from "./acciones";
import LogoAlpha from "@/components/LogoAlpha";
import { boton, campo } from "@/lib/ui";
import { Listo, Cerrar } from "@/lib/iconos";

function Requisito({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icono = ok ? Listo : Cerrar;
  return (
    <li
      className={
        "flex items-center gap-1.5 transition-colors " +
        (ok ? "text-tone-ok-fg" : "text-muted")
      }
    >
      <Icono className="h-3.5 w-3.5 shrink-0" />
      {children}
    </li>
  );
}

export default function ActualizarPasswordPage() {
  const [estado, accion, pendiente] = useActionState(actualizarPassword, null);
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");

  // Mismas reglas que valida el servidor (acciones.ts) — nada inventado aquí.
  const largoOk = password.length >= 8;
  const coincideOk = password.length > 0 && password === confirmar;

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <div className="banda-marca flex shrink-0 items-center justify-center p-8 md:w-[42%] md:min-h-screen">
        <LogoAlpha variante="blanco" className="h-9 w-auto" />
      </div>

      <div className="flex flex-1 items-center justify-center bg-bg p-6">
        <form action={accion} className="w-full max-w-sm space-y-4 text-text">
          <div>
            <h1 className="text-xl font-extrabold text-brand">
              Nueva contraseña
            </h1>
            <p className="text-sm text-muted">Elige una contraseña para tu cuenta.</p>
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className={campo}
            />
          </div>

          <ul className="space-y-1 text-xs font-semibold">
            <Requisito ok={largoOk}>Al menos 8 caracteres</Requisito>
            <Requisito ok={coincideOk}>Las dos contraseñas coinciden</Requisito>
          </ul>

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
      </div>
    </main>
  );
}
