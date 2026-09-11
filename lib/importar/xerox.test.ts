import { describe, expect, it } from "vitest";
import { parsearReporteXerox, emparejarSucursal } from "./xerox";

describe("parsearReporteXerox", () => {
  it("parsea un bloque real de WhatsApp con emojis y ubicación", () => {
    const texto = `LOS CABOS
*5746235*
▶️Modelo del equipo : 8270 Multifuncional AltaLink B8170
▶️Serie del equipo:  HHZ766464
▶️Razón social donde se comunica:  OPERADORA OMX
✅Dirección: AV BONAMPACK 200 LT 55SM 4A
✅Nombre de algun contacto:  CAROLINA CASTRO
✅Telefono de contacto:   99 81 90 80 92
✅Horario laboral: L A V 9 A 16 HRS
lineas y manchas en las impresiones`;

    const { bloques, duplicados } = parsearReporteXerox(texto);
    expect(duplicados).toEqual([]);
    expect(bloques).toHaveLength(1);
    expect(bloques[0]).toMatchObject({
      tarea: "5746235",
      ubicacion: "LOS CABOS",
      modelo: "8270 Multifuncional AltaLink B8170",
      serie: "HHZ766464",
      cliente: "OPERADORA OMX",
      direccion: "AV BONAMPACK 200 LT 55SM 4A",
      contacto: "CAROLINA CASTRO",
      telefono: "99 81 90 80 92",
      horario: "L A V 9 A 16 HRS",
      falla: "lineas y manchas en las impresiones",
    });
  });

  it("varios bloques toman la ubicación del último encabezado suelto visto", () => {
    const texto = `LOS CABOS
*1111*
falla uno

CD CARMEN
*2222*
falla dos`;

    const { bloques } = parsearReporteXerox(texto);
    expect(bloques).toHaveLength(2);
    expect(bloques[0].ubicacion).toBe("LOS CABOS");
    expect(bloques[1].ubicacion).toBe("CD CARMEN");
  });

  it("reporta como duplicada una tarea que se repite en el mismo texto pegado", () => {
    const texto = `*1111*
falla uno

*1111*
falla otra vez`;
    const { bloques, duplicados } = parsearReporteXerox(texto);
    expect(bloques).toHaveLength(2);
    expect(duplicados).toEqual(["1111"]);
  });

  it("líneas sueltas sin etiqueta reconocida se van acumulando en 'falla'", () => {
    const texto = `*1111*
primera línea de falla
segunda línea de falla`;
    const { bloques } = parsearReporteXerox(texto);
    expect(bloques[0].falla).toBe("primera línea de falla segunda línea de falla");
  });

  it("texto vacío no revienta, solo no produce bloques", () => {
    expect(parsearReporteXerox("")).toEqual({ bloques: [], duplicados: [] });
  });
});

describe("emparejarSucursal", () => {
  const sucursales = [
    { id: "s1", nombre: "Baja Digital Los Cabos" },
    { id: "s2", nombre: "Alpha Digital Cancún" },
  ];

  it("empareja quitando el prefijo de empresa (Alpha/Baja Digital)", () => {
    expect(emparejarSucursal("LOS CABOS", sucursales)).toEqual(sucursales[0]);
    expect(emparejarSucursal("CANCUN", sucursales)).toEqual(sucursales[1]);
  });

  it("null o sin coincidencia devuelve null — lo elige el coordinador a mano", () => {
    expect(emparejarSucursal(null, sucursales)).toBeNull();
    expect(emparejarSucursal("CIUDAD QUE NO EXISTE", sucursales)).toBeNull();
  });
});
