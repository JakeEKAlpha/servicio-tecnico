import webpush from "web-push";

let configurado = false;

/** Configura `web-push` con las VAPID keys una sola vez por proceso. */
function asegurarConfigurado() {
  if (configurado) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT en .env.local",
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configurado = true;
}

export type SuscripcionPush = {
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

export type PayloadPush = {
  titulo: string;
  cuerpo: string;
  /** Ruta a abrir al tocar la notificación, ej. "/campo/<id>". */
  url?: string;
};

/**
 * Manda un push a UNA suscripción. Devuelve si el envío fue exitoso y, si
 * el error indica que la suscripción ya no es válida (410/404 — el
 * navegador la dio de baja), lo marca para que el llamador la borre.
 */
export async function mandarPush(
  sub: SuscripcionPush,
  payload: PayloadPush,
): Promise<{ ok: true } | { ok: false; expirada: boolean; error: string }> {
  asegurarConfigurado();
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (e) {
    const statusCode = (e as { statusCode?: number })?.statusCode;
    const expirada = statusCode === 404 || statusCode === 410;
    return {
      ok: false,
      expirada,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
