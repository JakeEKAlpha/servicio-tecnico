import { describe, expect, it, vi } from "vitest";
import { enviarSiNuevo, marcarEnviado, yaEnviado } from "./dedup";

/** Doble mínimo de SupabaseClient para notificaciones_enviadas. */
function fakeSupabase(filas: { tipo: string; clave: string; destinatario_perfil_id: string }[]) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({
    select: () => ({
      eq: (col1: string, v1: string) => ({
        eq: (col2: string, v2: string) => ({
          eq: (col3: string, v3: string) => ({
            maybeSingle: async () => {
              const encontrada = filas.find(
                (f) =>
                  (f as unknown as Record<string, string>)[col1] === v1 &&
                  (f as unknown as Record<string, string>)[col2] === v2 &&
                  (f as unknown as Record<string, string>)[col3] === v3,
              );
              return { data: encontrada ?? null };
            },
          }),
        }),
      }),
    }),
    insert,
  }));
  return { supabase: { from } as unknown as Parameters<typeof yaEnviado>[0], insert };
}

describe("yaEnviado / marcarEnviado", () => {
  it("yaEnviado es false cuando no hay ninguna fila con ese tipo+clave+destinatario", async () => {
    const { supabase } = fakeSupabase([]);
    expect(await yaEnviado(supabase, "eta_sin_inicio", "orden-1", "perfil-1")).toBe(
      false,
    );
  });

  it("yaEnviado es true cuando ya existe exactamente esa combinación", async () => {
    const { supabase } = fakeSupabase([
      { tipo: "eta_sin_inicio", clave: "orden-1", destinatario_perfil_id: "perfil-1" },
    ]);
    expect(await yaEnviado(supabase, "eta_sin_inicio", "orden-1", "perfil-1")).toBe(
      true,
    );
  });

  it("una clave o destinatario distinto no cuenta como ya enviado", async () => {
    const { supabase } = fakeSupabase([
      { tipo: "eta_sin_inicio", clave: "orden-1", destinatario_perfil_id: "perfil-1" },
    ]);
    expect(await yaEnviado(supabase, "eta_sin_inicio", "orden-2", "perfil-1")).toBe(
      false,
    );
    expect(await yaEnviado(supabase, "eta_sin_inicio", "orden-1", "perfil-2")).toBe(
      false,
    );
  });

  it("marcarEnviado inserta la fila con las 3 columnas de dedup", async () => {
    const { supabase, insert } = fakeSupabase([]);
    await marcarEnviado(supabase, "urge_asignar", "orden-9", "perfil-3");
    expect(insert).toHaveBeenCalledWith({
      tipo: "urge_asignar",
      clave: "orden-9",
      destinatario_perfil_id: "perfil-3",
    });
  });
});

describe("enviarSiNuevo", () => {
  it("manda y marca cuando es la primera vez", async () => {
    const { supabase, insert } = fakeSupabase([]);
    const enviar = vi.fn().mockResolvedValue(undefined);
    await enviarSiNuevo(supabase, "urge_asignar", "orden-1", "perfil-1", enviar);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("no manda de nuevo si ya se había enviado — esto es lo que evita el spam cada 15 min", async () => {
    const { supabase, insert } = fakeSupabase([
      { tipo: "urge_asignar", clave: "orden-1", destinatario_perfil_id: "perfil-1" },
    ]);
    const enviar = vi.fn().mockResolvedValue(undefined);
    await enviarSiNuevo(supabase, "urge_asignar", "orden-1", "perfil-1", enviar);
    expect(enviar).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
