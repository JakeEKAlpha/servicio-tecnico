import { describe, expect, it } from "vitest";
import { parseHoraEta, fmtHora } from "./horas";

describe("parseHoraEta", () => {
  it("parsea 24 horas simple", () => {
    expect(parseHoraEta("14:30")).toEqual({ inicio: 14.5, fin: null });
  });

  it("parsea a. m. / p. m. con puntos y espacios", () => {
    expect(parseHoraEta("10:00 a. m.")).toEqual({ inicio: 10, fin: null });
    expect(parseHoraEta("2:00 p. m.")).toEqual({ inicio: 14, fin: null });
  });

  it("12 a. m. es medianoche (hora 0), 12 p. m. sigue siendo mediodía", () => {
    expect(parseHoraEta("12:00 a. m.")).toEqual({ inicio: 0, fin: null });
    expect(parseHoraEta("12:00 p. m.")).toEqual({ inicio: 12, fin: null });
  });

  it("parsea un rango y lo devuelve como inicio/fin", () => {
    expect(parseHoraEta("10:00 a. m. - 11:00 a. m.")).toEqual({
      inicio: 10,
      fin: 11,
    });
  });

  it("si el fin del rango no es después del inicio, se descarta (queda solo el inicio)", () => {
    expect(parseHoraEta("11:00 a. m. - 10:00 a. m.")).toEqual({
      inicio: 11,
      fin: null,
    });
  });

  it("null, vacío o texto irreconocible devuelven null", () => {
    expect(parseHoraEta(null)).toBeNull();
    expect(parseHoraEta(undefined)).toBeNull();
    expect(parseHoraEta("")).toBeNull();
    expect(parseHoraEta("sin hora definida")).toBeNull();
  });
});

describe("fmtHora", () => {
  it("convierte una hora decimal a HH:MM con ceros a la izquierda", () => {
    expect(fmtHora(9.5)).toBe("09:30");
    expect(fmtHora(14)).toBe("14:00");
    expect(fmtHora(0)).toBe("00:00");
  });
});
