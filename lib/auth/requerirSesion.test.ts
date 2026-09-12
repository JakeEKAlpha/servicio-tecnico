import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { requerirUsuario, requerirPerfil } from "./requerirSesion";

type Usuario = { id: string } | null;
type PerfilFila = { rol: string; zona_id: string | null; ingeniero_id: string | null } | null;

/** Doble mínimo de `SupabaseClient` — solo `auth.getUser()` y
 *  `.from("perfiles").select().eq().maybeSingle()`, que es todo lo que usa
 *  `requerirSesion.ts`. Mismo patrón que el resto de tests de route handlers. */
function fakeSupabase(opts: {
  usuario: Usuario;
  perfil?: PerfilFila;
  perfilError?: { message: string } | null;
}) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: opts.perfil ?? null, error: opts.perfilError ?? null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: opts.usuario } }) },
    from,
  };
}

function mockCreateClient(supabase: unknown) {
  vi.mocked(createClient).mockResolvedValue(
    supabase as Awaited<ReturnType<typeof createClient>>,
  );
}

describe("requerirUsuario", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
  });

  it("401 si no hay sesión", async () => {
    mockCreateClient(fakeSupabase({ usuario: null }));
    const r = await requerirUsuario();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.status).toBe(401);
  });

  it("ok con el userId si hay sesión", async () => {
    mockCreateClient(fakeSupabase({ usuario: { id: "u1" } }));
    const r = await requerirUsuario();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.userId).toBe("u1");
  });
});

describe("requerirPerfil", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
  });

  it("401 si no hay sesión", async () => {
    mockCreateClient(fakeSupabase({ usuario: null }));
    const r = await requerirPerfil();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.status).toBe(401);
  });

  it("500 si falla la consulta a perfiles", async () => {
    mockCreateClient(
      fakeSupabase({ usuario: { id: "u1" }, perfilError: { message: "boom" } }),
    );
    const r = await requerirPerfil();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.status).toBe(500);
  });

  it("403 si el usuario no tiene perfil", async () => {
    mockCreateClient(fakeSupabase({ usuario: { id: "u1" }, perfil: null }));
    const r = await requerirPerfil();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.status).toBe(403);
  });

  it("403 si el rol no está en la lista permitida", async () => {
    mockCreateClient(
      fakeSupabase({
        usuario: { id: "u1" },
        perfil: { rol: "coordinador", zona_id: "z1", ingeniero_id: null },
      }),
    );
    const r = await requerirPerfil({ roles: ["gerencia", "admin"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.status).toBe(403);
  });

  it("ok con el perfil si el rol está permitido", async () => {
    mockCreateClient(
      fakeSupabase({
        usuario: { id: "u1" },
        perfil: { rol: "gerencia", zona_id: null, ingeniero_id: null },
      }),
    );
    const r = await requerirPerfil({ roles: ["gerencia", "admin"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.perfil.rol).toBe("gerencia");
  });

  it("ok sin filtro de roles para cualquier perfil válido", async () => {
    mockCreateClient(
      fakeSupabase({
        usuario: { id: "u1" },
        perfil: { rol: "ingeniero", zona_id: "z1", ingeniero_id: "i1" },
      }),
    );
    const r = await requerirPerfil();
    expect(r.ok).toBe(true);
  });
});
