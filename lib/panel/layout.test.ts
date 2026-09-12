import { describe, expect, it } from "vitest";
import { mergeLayout, type PanelLayout } from "./layout";

/** Un layout guardado que simula a un usuario que personalizó su panel
 *  ANTES de que "relojes" existiera en el catálogo — no lo incluye. */
function layoutGuardadoSinRelojes(): PanelLayout {
  return {
    lg: [
      // Posiciones movidas a mano, deliberadamente "fuera de orden" respecto
      // a ORDEN_DEFECTO — lo que un usuario real haría al reacomodar.
      { i: "agenda", x: 8, y: 0, w: 4, h: 3 },
      { i: "atencion", x: 0, y: 0, w: 8, h: 5 },
      { i: "filtros", x: 0, y: 5, w: 12, h: 2 },
    ],
    md: [
      { i: "agenda", x: 0, y: 0, w: 3, h: 3 },
      { i: "atencion", x: 3, y: 0, w: 5, h: 5 },
      { i: "filtros", x: 0, y: 5, w: 8, h: 2 },
    ],
    sm: [
      { i: "atencion", x: 0, y: 0, w: 1, h: 5 },
      { i: "agenda", x: 0, y: 5, w: 1, h: 3 },
      { i: "filtros", x: 0, y: 8, w: 1, h: 2 },
    ],
    ocultos: [],
  };
}

describe("mergeLayout", () => {
  it("cuenta nueva (sin nada guardado) usa el acomodo default tal cual", () => {
    const resultado = mergeLayout(null, "coordinador");
    expect(resultado.lg.length).toBeGreaterThan(0);
    expect(resultado.ocultos).toEqual([]);
  });

  it("un widget nuevo del catálogo (no estaba en lo guardado) entra al FINAL, no en medio", () => {
    const guardado = layoutGuardadoSinRelojes();
    const resultado = mergeLayout(guardado, "coordinador");

    // Los widgets que el usuario ya tenía conservan exactamente su posición
    // guardada (no se recalculan contra el orden por defecto).
    const agenda = resultado.lg.find((it) => it.i === "agenda")!;
    const atencion = resultado.lg.find((it) => it.i === "atencion")!;
    const filtros = resultado.lg.find((it) => it.i === "filtros")!;
    expect(agenda).toMatchObject({ x: 8, y: 0, w: 4, h: 3 });
    expect(atencion).toMatchObject({ x: 0, y: 0, w: 8, h: 5 });
    expect(filtros).toMatchObject({ x: 0, y: 5, w: 12, h: 2 });

    // "relojes" (nunca guardado por este usuario) aparece, y su `y` cae en
    // o después del punto más bajo de lo que el usuario ya tenía — nunca
    // se cuela encima o en medio de sus widgets existentes.
    const maxYExistente = Math.max(
      agenda.y + agenda.h,
      atencion.y + atencion.h,
      filtros.y + filtros.h,
    );
    const relojes = resultado.lg.find((it) => it.i === "relojes");
    expect(relojes).toBeDefined();
    expect(relojes!.y).toBeGreaterThanOrEqual(maxYExistente);
  });

  it("un id guardado que ya no existe en el catálogo no rompe el merge", () => {
    const guardado: PanelLayout = {
      lg: [{ i: "widget-fantasma-que-ya-no-existe", x: 0, y: 0, w: 4, h: 2 }],
      md: [],
      sm: [],
      ocultos: [],
    };
    const resultado = mergeLayout(guardado, "coordinador");
    expect(resultado.lg.find((it) => it.i === "widget-fantasma-que-ya-no-existe")).toBeUndefined();
    // El resto del catálogo default se sigue armando con normalidad.
    expect(resultado.lg.length).toBeGreaterThan(0);
  });
});
