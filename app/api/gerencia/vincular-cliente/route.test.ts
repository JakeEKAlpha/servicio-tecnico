import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gerencia/api", () => ({
  contextoGerencia: vi.fn(),
}));

import { contextoGerencia } from "@/lib/gerencia/api";
import { POST } from "./route";

type SupabaseError = { code?: string; message: string } | null;

/**
 * Doble mínimo de `SupabaseClient` — solo lo que `route.ts` realmente usa
 * (`.from(...).update(...).eq(...)`). Se castea el tipo a propósito: exigirle
 * el tipo completo de `SupabaseClient` no aporta nada aquí y solo obligaría a
 * rellenar decenas de propiedades que el código bajo prueba nunca toca.
 */
function fakeSupabase(updateResult: { error: SupabaseError }) {
  const eq = vi.fn().mockResolvedValue(updateResult);
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from } as unknown as { from: typeof from };
}

/** Misma idea que `fakeSupabase`: castea el valor mockeado de
 * `contextoGerencia` sin tener que satisfacer el tipo completo de
 * `SupabaseClient`/`NextResponse`. */
function mockContexto(valor: unknown) {
  vi.mocked(contextoGerencia).mockResolvedValue(
    valor as Awaited<ReturnType<typeof contextoGerencia>>,
  );
}

function req(body: unknown) {
  return new Request("http://localhost/api/gerencia/vincular-cliente", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/gerencia/vincular-cliente", () => {
  beforeEach(() => {
    vi.mocked(contextoGerencia).mockReset();
  });

  it("si contextoGerencia rechaza (no gerencia), devuelve tal cual esa respuesta sin tocar la BD", async () => {
    const res401 = new Response(
      JSON.stringify({ ok: false, error: "Esta acción es solo para gerencia." }),
      { status: 403 },
    );
    mockContexto({ ok: false, res: res401 });

    const res = await POST(req({ ordenId: "o1", clienteId: "c1" }));
    expect(res.status).toBe(403);
  });

  it("400 si falta ordenId o clienteId", async () => {
    const supabase = fakeSupabase({ error: null });
    mockContexto({ ok: true, supabase });

    const res = await POST(req({ ordenId: "o1" }));
    expect(res.status).toBe(400);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("400 con cuerpo que no es JSON válido", async () => {
    mockContexto({ ok: true, supabase: fakeSupabase({ error: null }) });
    const res = await POST(req("esto no es json"));
    expect(res.status).toBe(400);
  });

  it("actualiza ordenes.cliente_id por el id de la orden y responde ok", async () => {
    const supabase = fakeSupabase({ error: null });
    mockContexto({ ok: true, supabase });

    const res = await POST(req({ ordenId: "o1", clienteId: "c1" }));
    const data = await res.json();

    expect(data).toEqual({ ok: true });
    expect(supabase.from).toHaveBeenCalledWith("ordenes");
    expect(supabase.from("ordenes").update).toHaveBeenCalledWith({
      cliente_id: "c1",
    });
  });

  it("400 con mensaje claro cuando el cliente no existe (violación de FK, código 23503)", async () => {
    const supabase = fakeSupabase({
      error: { code: "23503", message: "foreign key violation" },
    });
    mockContexto({ ok: true, supabase });

    const res = await POST(req({ ordenId: "o1", clienteId: "no-existe" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/no existe/i);
  });

  it("500 con el mensaje de Supabase para cualquier otro error de BD", async () => {
    const supabase = fakeSupabase({
      error: { code: "42501", message: "insufficient privilege" },
    });
    mockContexto({ ok: true, supabase });

    const res = await POST(req({ ordenId: "o1", clienteId: "c1" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("insufficient privilege");
  });
});
