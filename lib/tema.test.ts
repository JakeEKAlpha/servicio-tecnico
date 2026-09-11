import { describe, expect, it } from "vitest";
import { chipServicio } from "./tema";

describe("chipServicio", () => {
  it("Xerox siempre es rojo, sin importar el origen", () => {
    expect(chipServicio("WO", "Xerox")).toEqual({ texto: "Xerox", tono: "rojo" });
    expect(chipServicio(null, "xerox")).toEqual({ texto: "Xerox", tono: "rojo" });
  });

  it("SR es ámbar (warn), WO Lexmark es verde (ok)", () => {
    expect(chipServicio("SR", "Lexmark")).toEqual({ texto: "SR", tono: "warn" });
    expect(chipServicio("WO", "Lexmark")).toEqual({ texto: "WO", tono: "ok" });
  });

  it("todo lo demás (Alpha Digital, manual) es azul (info)", () => {
    expect(chipServicio("MANUAL", "Propio")).toEqual({ texto: "Alpha", tono: "info" });
    expect(chipServicio(null, null)).toEqual({ texto: "Alpha", tono: "info" });
  });
});
