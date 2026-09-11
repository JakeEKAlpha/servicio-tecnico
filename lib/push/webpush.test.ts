import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

const sub = { endpoint: "https://push.example/abc", p256dh: "p", auth_key: "a" };

describe("mandarPush", () => {
  beforeEach(() => {
    sendNotification.mockReset();
    setVapidDetails.mockReset();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "clave-publica";
    process.env.VAPID_PRIVATE_KEY = "clave-privada";
    process.env.VAPID_SUBJECT = "mailto:coordinacion@alphadigital.com.mx";
    vi.resetModules();
  });

  it("configura VAPID una sola vez y manda la notificación", async () => {
    sendNotification.mockResolvedValue(undefined);
    const { mandarPush } = await import("./webpush");

    const r = await mandarPush(sub, { titulo: "Hola", cuerpo: "Mundo" });

    expect(r).toEqual({ ok: true });
    expect(setVapidDetails).toHaveBeenCalledTimes(1);
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: sub.endpoint, keys: { p256dh: "p", auth: "a" } },
      JSON.stringify({ titulo: "Hola", cuerpo: "Mundo" }),
    );
  });

  it("marca expirada:true cuando el navegador dio de baja la suscripción (410/404)", async () => {
    sendNotification.mockRejectedValueOnce(
      Object.assign(new Error("Gone"), { statusCode: 410 }),
    );
    const { mandarPush } = await import("./webpush");
    const r = await mandarPush(sub, { titulo: "x", cuerpo: "y" });
    expect(r).toEqual({ ok: false, expirada: true, error: "Gone" });

    sendNotification.mockRejectedValueOnce(
      Object.assign(new Error("Not found"), { statusCode: 404 }),
    );
    const r2 = await mandarPush(sub, { titulo: "x", cuerpo: "y" });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.expirada).toBe(true);
  });

  it("marca expirada:false para cualquier otro error (ej. 500 del servicio push)", async () => {
    sendNotification.mockRejectedValueOnce(
      Object.assign(new Error("Server error"), { statusCode: 500 }),
    );
    const { mandarPush } = await import("./webpush");
    const r = await mandarPush(sub, { titulo: "x", cuerpo: "y" });
    expect(r).toEqual({ ok: false, expirada: false, error: "Server error" });
  });

  it("lanza si faltan las VAPID keys — un typo en .env no debe fallar en silencio", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const { mandarPush } = await import("./webpush");
    await expect(mandarPush(sub, { titulo: "x", cuerpo: "y" })).rejects.toThrow(
      /VAPID/,
    );
  });
});
