import { beforeEach, describe, expect, it, vi } from "vitest";

const mandarPush = vi.fn();
vi.mock("./webpush", () => ({
  mandarPush: (...args: unknown[]) => mandarPush(...args),
}));

import { enviarPushAPerfil, enviarPushARol } from "./enviar";

/** Doble mínimo de SupabaseClient — solo `.from(tabla).select().eq()...`. */
function fakeSupabase(tablas: Record<string, unknown[]>) {
  const deleteMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  function builderPara(nombreTabla: string, filas: unknown[]) {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((columna: string, valor: unknown) => {
        // Filtra en memoria — suficiente para lo que usan enviarPushAPerfil/ARol.
        const filtradas = filas.filter(
          (f) => (f as Record<string, unknown>)[columna] === valor,
        );
        return Object.assign(Promise.resolve({ data: filtradas }), builder, {
          in: builder.in,
        });
      }),
      in: vi.fn((columna: string, valores: unknown[]) => {
        const filtradas = filas.filter((f) =>
          valores.includes((f as Record<string, unknown>)[columna]),
        );
        return Object.assign(Promise.resolve({ data: filtradas }), builder, {
          eq: builder.eq,
        });
      }),
      delete: () => ({ eq: deleteMock().eq }),
    };
    void nombreTabla;
    return builder;
  }

  const from = vi.fn((tabla: string) => builderPara(tabla, tablas[tabla] ?? []));
  return { from } as unknown as Parameters<typeof enviarPushAPerfil>[0];
}

describe("enviarPushAPerfil", () => {
  beforeEach(() => mandarPush.mockReset());

  it("no hace nada si el perfil no tiene ninguna suscripción", async () => {
    const supabase = fakeSupabase({ push_subscripciones: [] });
    await enviarPushAPerfil(supabase, "perfil-1", { titulo: "x", cuerpo: "y" });
    expect(mandarPush).not.toHaveBeenCalled();
  });

  it("manda el push a cada suscripción del perfil (varios dispositivos)", async () => {
    mandarPush.mockResolvedValue({ ok: true });
    const supabase = fakeSupabase({
      push_subscripciones: [
        { id: "s1", perfil_id: "perfil-1", endpoint: "e1", p256dh: "p", auth_key: "a" },
        { id: "s2", perfil_id: "perfil-1", endpoint: "e2", p256dh: "p", auth_key: "a" },
        { id: "s3", perfil_id: "otro-perfil", endpoint: "e3", p256dh: "p", auth_key: "a" },
      ],
    });
    await enviarPushAPerfil(supabase, "perfil-1", { titulo: "Hola", cuerpo: "y" });
    expect(mandarPush).toHaveBeenCalledTimes(2);
  });
});

describe("enviarPushARol", () => {
  beforeEach(() => mandarPush.mockReset());

  it("manda a todos los perfiles con alguno de los roles pedidos", async () => {
    mandarPush.mockResolvedValue({ ok: true });
    const supabase = fakeSupabase({
      perfiles: [
        { id: "g1", rol: "gerencia", zona_id: null },
        { id: "a1", rol: "admin", zona_id: null },
        { id: "c1", rol: "coordinador", zona_id: "z1" },
      ],
      push_subscripciones: [
        { id: "s1", perfil_id: "g1", endpoint: "e1", p256dh: "p", auth_key: "a" },
        { id: "s2", perfil_id: "a1", endpoint: "e2", p256dh: "p", auth_key: "a" },
      ],
    });
    await enviarPushARol(supabase, { roles: ["gerencia", "admin"] }, {
      titulo: "x",
      cuerpo: "y",
    });
    expect(mandarPush).toHaveBeenCalledTimes(2);
  });

  it("no manda nada si ningún perfil coincide con el rol", async () => {
    const supabase = fakeSupabase({ perfiles: [], push_subscripciones: [] });
    await enviarPushARol(supabase, { roles: ["gerencia"] }, { titulo: "x", cuerpo: "y" });
    expect(mandarPush).not.toHaveBeenCalled();
  });
});
