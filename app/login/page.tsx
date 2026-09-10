"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { iniciarSesion, recuperarPassword } from "./acciones";
import LogoAlpha from "@/components/LogoAlpha";
import { boton, campo as inputCls } from "@/lib/ui";

const cardCls =
  "w-full max-w-sm space-y-4 rounded-2xl border border-border-default bg-surface p-7 text-text shadow-xl";

function FormularioLogin() {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, null);
  const enlaceInvalido =
    useSearchParams().get("error") === "enlace_invalido";
  return (
    <form action={accion} className={cardCls}>
      <div>
        <h1 className="text-lg font-extrabold text-brand">Servicio Técnico</h1>
        <p className="text-sm text-muted">Inicia sesión para continuar</p>
      </div>
      {enlaceInvalido && (
        <p className="rounded-lg bg-tone-warn-bg px-3 py-2 text-sm text-tone-warn-fg">
          El enlace ya no es válido o expiró. Pide uno nuevo.
        </p>
      )}
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-semibold">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputCls}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-semibold">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputCls}
        />
      </div>
      {estado?.error && (
        <p className="text-sm text-danger">{estado.error}</p>
      )}
      <button type="submit" disabled={pendiente} className={boton + " w-full"}>
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

function FormularioRecuperar() {
  const [estado, accion, pendiente] = useActionState(recuperarPassword, null);
  const ok = estado && "ok" in estado ? estado.ok : null;
  const error = estado && "error" in estado ? estado.error : null;
  return (
    <form action={accion} className={cardCls}>
      <div>
        <h1 className="text-lg font-extrabold text-brand">
          Recuperar contraseña
        </h1>
        <p className="text-sm text-muted">
          Te enviamos un enlace para elegir una nueva.
        </p>
      </div>
      <div className="space-y-1">
        <label htmlFor="email-rec" className="text-sm font-semibold">
          Correo
        </label>
        <input
          id="email-rec"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputCls}
        />
      </div>
      {ok && <p className="text-sm text-success">{ok}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={pendiente} className={boton + " w-full"}>
        {pendiente ? "Enviando…" : "Enviar enlace"}
      </button>
    </form>
  );
}

function LoginContenido() {
  const [modo, setModo] = useState<"login" | "recuperar">("login");

  return (
    <main className="banda-marca flex min-h-screen flex-col items-center justify-center gap-5 p-4">
      <LogoAlpha variante="blanco" className="h-10 w-auto" />
      {modo === "login" ? <FormularioLogin /> : <FormularioRecuperar />}
      <button
        type="button"
        onClick={() => setModo(modo === "login" ? "recuperar" : "login")}
        className="text-sm text-white/80 underline hover:text-white"
      >
        {modo === "login"
          ? "¿Olvidaste tu contraseña?"
          : "Volver a iniciar sesión"}
      </button>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContenido />
    </Suspense>
  );
}
