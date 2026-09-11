"use client";

import { useEffect, useState } from "react";

/** VAPID key pública viene en base64url — el navegador necesita un
 *  Uint8Array para `applicationServerKey`. Conversión estándar. */
function base64UrlAUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function suscribir(): Promise<boolean> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return false;

  const registro = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await registro.pushManager.getSubscription();
  if (!sub) {
    sub = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlAUint8Array(vapidPublicKey),
    });
  }

  const json = sub.toJSON();
  const r = await fetch("/api/push/suscribir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  return r.ok;
}

/**
 * Botón discreto para que el ingeniero active notificaciones push en su
 * celular (nueva asignación, pieza disponible...). Se monta solo en
 * `/campo` — es la única superficie donde el ingeniero usa la app.
 *
 * Sin nagging: si ya está activado, no muestra nada; si el usuario lo negó
 * antes, tampoco insiste — solo aparece cuando de verdad hace falta pedirlo.
 */
export default function ActivarNotificaciones() {
  const [estado, setEstado] = useState<
    "revisando" | "no-soportado" | "puede-pedir" | "activo" | "denegado" | "error"
  >("revisando");

  useEffect(() => {
    // Todo el chequeo va detrás de un microtask (el `async` de esta función
    // inline) a propósito: la regla de React pide no llamar `setState` de
    // forma sincrónica en el cuerpo del efecto, aunque aquí la condición en
    // sí (soporte del navegador, permiso ya dado) sea instantánea.
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setEstado("no-soportado");
        return;
      }
      if (Notification.permission === "granted") {
        // Ya lo aceptó antes — asegura la suscripción en silencio, sin UI.
        try {
          const ok = await suscribir();
          setEstado(ok ? "activo" : "error");
        } catch {
          setEstado("error");
        }
      } else if (Notification.permission === "denied") {
        setEstado("denegado");
      } else {
        setEstado("puede-pedir");
      }
    })();
  }, []);

  async function activar() {
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "denegado" : "puede-pedir");
        return;
      }
      const ok = await suscribir();
      setEstado(ok ? "activo" : "error");
    } catch {
      setEstado("error");
    }
  }

  if (estado !== "puede-pedir") return null;

  return (
    <button
      type="button"
      onClick={activar}
      className="mb-3 w-full rounded-lg border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-left text-xs font-semibold text-emerald-900"
    >
      🔔 Activar notificaciones — nuevas asignaciones y piezas disponibles
    </button>
  );
}
