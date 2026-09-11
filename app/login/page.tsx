"use client";

import { Suspense, useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { iniciarSesion, recuperarPassword } from "./acciones";
import LogoAlpha from "@/components/LogoAlpha";
import { EMPRESA_ALPHA } from "@/lib/empresa";
import { boton, campo as inputCls, etiqueta } from "@/lib/ui";
import { Correo, Llamar } from "@/lib/iconos";

const cardCls = "w-full max-w-sm space-y-4 text-text";

const CLAVE_CORREO = "login-email";

/**
 * Recuerda el último correo usado para no reescribirlo. Rellena el campo al
 * montar y lo guarda al enviar el formulario. Todo dentro de try/catch: en
 * navegación privada o con el almacenamiento bloqueado simplemente no aplica.
 */
function useCorreoRecordado() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_CORREO);
      if (guardado && ref.current && !ref.current.value) {
        ref.current.value = guardado;
      }
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  const recordar = (e: React.FormEvent<HTMLFormElement>) => {
    try {
      const correo = new FormData(e.currentTarget).get("email");
      if (typeof correo === "string" && correo) {
        localStorage.setItem(CLAVE_CORREO, correo);
      }
    } catch {
      /* almacenamiento no disponible */
    }
  };

  return { ref, recordar };
}

function FormularioLogin() {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, null);
  const enlaceInvalido =
    useSearchParams().get("error") === "enlace_invalido";
  const { ref: correoRef, recordar } = useCorreoRecordado();
  return (
    <form action={accion} onSubmit={recordar} className={cardCls}>
      <div>
        <h1 className="text-xl font-extrabold text-brand">Inicia sesión</h1>
        <p className="text-sm text-muted">Entra con tu cuenta de Servicio Técnico.</p>
      </div>
      {enlaceInvalido && (
        <p className="rounded-lg bg-tone-warn-bg px-3 py-2 text-sm text-tone-warn-fg">
          El enlace ya no es válido o expiró. Pide uno nuevo.
        </p>
      )}
      <div className="space-y-1">
        <label htmlFor="email" className={etiqueta}>
          Correo
        </label>
        <input
          ref={correoRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputCls}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className={etiqueta}>
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
  const { ref: correoRef, recordar } = useCorreoRecordado();
  return (
    <form action={accion} onSubmit={recordar} className={cardCls}>
      <div>
        <h1 className="text-xl font-extrabold text-brand">
          Recuperar contraseña
        </h1>
        <p className="text-sm text-muted">
          Te enviamos un enlace para elegir una nueva.
        </p>
      </div>
      <div className="space-y-1">
        <label htmlFor="email-rec" className={etiqueta}>
          Correo
        </label>
        <input
          ref={correoRef}
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
    <main className="flex min-h-screen flex-col md:flex-row">
      {/* Izquierda: marca + a quién sirve + a quién llamar (wireframe 10d) */}
      <div className="banda-marca flex shrink-0 flex-col justify-between gap-8 p-8 md:w-[42%] md:min-h-screen md:p-12">
        <LogoAlpha variante="blanco" className="h-9 w-auto" />

        <div className="max-w-sm space-y-3 text-white">
          <h2 className="text-2xl font-extrabold leading-tight">
            Servicio Técnico
          </h2>
          <p className="text-sm leading-relaxed text-white/85">
            Coordina visitas, piezas y documentación de servicio Lexmark y
            Xerox. Lo usan coordinadores de zona, ingenieros en campo,
            almacén y gerencia — cada quien ve solo lo suyo.
          </p>
        </div>

        <div className="space-y-2 text-sm text-white/85">
          <p className="text-xs font-bold uppercase tracking-wide text-white/60">
            ¿No puedes entrar?
          </p>
          <a
            href={`mailto:${EMPRESA_ALPHA.correo}`}
            className="flex items-center gap-2 hover:text-white"
          >
            <Correo className="h-4 w-4 shrink-0" />
            {EMPRESA_ALPHA.correo}
          </a>
          <a
            href={`tel:${EMPRESA_ALPHA.telefono.replace(/\D/g, "")}`}
            className="flex items-center gap-2 hover:text-white"
          >
            <Llamar className="h-4 w-4 shrink-0" />
            {EMPRESA_ALPHA.telefono}
          </a>
        </div>
      </div>

      {/* Derecha: formulario */}
      <div className="flex flex-1 items-center justify-center bg-bg p-6">
        <div className="w-full max-w-sm">
          {modo === "login" ? <FormularioLogin /> : <FormularioRecuperar />}
          <button
            type="button"
            onClick={() => setModo(modo === "login" ? "recuperar" : "login")}
            className="mt-4 text-sm font-medium text-muted underline hover:text-brand"
          >
            {modo === "login"
              ? "¿Olvidaste tu contraseña?"
              : "Volver a iniciar sesión"}
          </button>
        </div>
      </div>
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
