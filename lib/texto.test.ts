import { describe, expect, it } from "vitest";
import { primerasMayusculas } from "./texto";

describe("primerasMayusculas", () => {
  it("pone en mayúscula la primera letra de cada palabra", () => {
    expect(primerasMayusculas("juan lazaro mayo chan")).toBe("Juan Lazaro Mayo Chan");
  });

  it("baja el resto de cada palabra, incluida una que venía toda en mayúsculas", () => {
    expect(primerasMayusculas("TIENDAS SORIANA")).toBe("Tiendas Soriana");
  });

  it("deja los conectores en minúscula cuando no van al inicio", () => {
    expect(primerasMayusculas("parque de la industria")).toBe("Parque de la Industria");
  });

  it("sí capitaliza un conector si es la primera palabra", () => {
    expect(primerasMayusculas("de la torre")).toBe("De la Torre");
  });

  it("colapsa espacios repetidos y recorta los de los extremos", () => {
    expect(primerasMayusculas("  juan   perez  ")).toBe("Juan Perez");
  });

  it("cadena vacía o solo espacios da cadena vacía", () => {
    expect(primerasMayusculas("")).toBe("");
    expect(primerasMayusculas("   ")).toBe("");
  });
});
