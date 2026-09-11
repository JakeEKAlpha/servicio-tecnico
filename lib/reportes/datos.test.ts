import { describe, expect, it, vi } from "vitest";
import { cargarOrdenesAnalitica } from "./datos";

/** Builder encadenable mínimo — cada método filtra en memoria y regresa
 *  `this`; es "then-able" para que `await query` funcione como el cliente
 *  real de Supabase. */
function fakeQuery(filas: Record<string, unknown>[]) {
  let datos = filas;
  const builder = {
    select: vi.fn(() => builder),
    gte: vi.fn((col: string, v: string) => {
      datos = datos.filter((f) => String(f[col]) >= v);
      return builder;
    }),
    lte: vi.fn((col: string, v: string) => {
      datos = datos.filter((f) => String(f[col]) <= v);
      return builder;
    }),
    eq: vi.fn((col: string, v: unknown) => {
      datos = datos.filter((f) => f[col] === v);
      return builder;
    }),
    in: vi.fn((col: string, valores: unknown[]) => {
      datos = datos.filter((f) => valores.includes(f[col]));
      return builder;
    }),
    order: vi.fn(() => builder),
    then: (resolve: (r: { data: unknown; error: null }) => void) =>
      resolve({ data: datos, error: null }),
  };
  return builder;
}

function fakeSupabase(ordenes: Record<string, unknown>[], historial: Record<string, unknown>[]) {
  const from = vi.fn((tabla: string) => {
    if (tabla === "ordenes") return fakeQuery(ordenes);
    if (tabla === "ordenes_historial") return fakeQuery(historial);
    return fakeQuery([]);
  });
  return { from } as unknown as Parameters<typeof cargarOrdenesAnalitica>[0];
}

const filaBase = {
  id: "o1",
  numero_orden: "123",
  origen: "SR",
  estatus: "Concluido",
  cliente: "Cliente X",
  creado_en: "2026-09-01T00:00:00Z",
  actualizado_en: "2026-09-05T00:00:00Z",
  fecha_eta: null,
  datos_especificos: {},
  sucursales: null,
  ingenieros: null,
  marcas: { nombre: "Lexmark" },
  contratos: null,
};

describe("cargarOrdenesAnalitica", () => {
  it("usa la fecha del historial (transición a Concluido) cuando existe", async () => {
    const supabase = fakeSupabase(
      [filaBase],
      [{ orden_id: "o1", cambiado_en: "2026-09-04T00:00:00Z", estatus_nuevo: "Concluido" }],
    );
    const { ordenes, error } = await cargarOrdenesAnalitica(supabase, {});
    expect(error).toBeNull();
    expect(ordenes[0].concluido_en).toBe("2026-09-04T00:00:00Z");
  });

  it("si está Concluido pero no hay fila de historial, usa actualizado_en como respaldo", async () => {
    const supabase = fakeSupabase([filaBase], []); // sin historial
    const { ordenes } = await cargarOrdenesAnalitica(supabase, {});
    expect(ordenes[0].concluido_en).toBe(filaBase.actualizado_en);
  });

  it("si NO está Concluido, concluido_en es null aunque no haya historial", async () => {
    const supabase = fakeSupabase([{ ...filaBase, estatus: "Asignado" }], []);
    const { ordenes } = await cargarOrdenesAnalitica(supabase, {});
    expect(ordenes[0].concluido_en).toBeNull();
  });

  it("resuelve la relación de marca (objeto) a marca_nombre plano", async () => {
    const supabase = fakeSupabase([filaBase], []);
    const { ordenes } = await cargarOrdenesAnalitica(supabase, {});
    expect(ordenes[0].marca_nombre).toBe("Lexmark");
  });
});
