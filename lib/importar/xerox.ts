/**
 * Parseo de reportes Xerox pegados en el formato de WhatsApp/correo que usa
 * el equipo de campo, p. ej.:
 *
 *   *5746235*
 *   ▶️Modelo del equipo : 8270 Multifuncional AltaLink B8170
 *   ▶️Serie del equipo:  HHZ766464
 *   ▶️Razón social donde se comunica:  OPERADORA OMX
 *   ✅Dirección: AV BONAMPACK 200 LT 55SM 4A
 *   ✅Nombre de algun contacto:  CAROLINA CASTRO
 *   ✅Telefono de contacto:   99 81 90 80 92
 *   ✅Horario laboral: L A V 9 A 16 HRS
 *   lineas y manchas en las impresiones
 *
 *   LOS CABOS
 *   *5746299*
 *   …
 *
 * El número entre asteriscos es el **número de tarea**: cada visita del
 * ingeniero tiene el suyo. Un mismo reporte (Xerox también le dice "SR",
 * pero NO es el mismo concepto que el `origen='SR'` de Lexmark) puede tener
 * varias tareas hasta que se concluye — ese número de SR no viene en el
 * texto pegado, lo captura el coordinador aparte (ver ModalPegarXerox).
 *
 * Una línea suelta (sin emoji, sin "*tarea*") antes de un bloque es el
 * encabezado de ubicación/ciudad y aplica a los bloques siguientes hasta
 * que cambie.
 */

export type BloqueXerox = {
  tarea: string;
  ubicacion: string | null;
  modelo: string | null;
  serie: string | null;
  cliente: string | null;
  direccion: string | null;
  contacto: string | null;
  telefono: string | null;
  horario: string | null;
  falla: string | null;
};

function limpio(v: string | undefined | null): string {
  return (v ?? "").trim();
}

/** Quita el emoji/símbolo inicial (▶️, ✅, •, -, …) sin depender de cuál sea. */
function sinAdorno(linea: string): string {
  return linea.replace(/^[^\p{L}0-9]+/u, "").trim();
}

type CampoTexto = Exclude<keyof BloqueXerox, "tarea">;

const CAMPOS: { etiqueta: RegExp; campo: CampoTexto }[] = [
  { etiqueta: /^modelo del equipo[^:]*:\s*/i, campo: "modelo" },
  { etiqueta: /^serie del equipo[^:]*:\s*/i, campo: "serie" },
  { etiqueta: /^raz[oó]n social[^:]*:\s*/i, campo: "cliente" },
  { etiqueta: /^direcci[oó]n[^:]*:\s*/i, campo: "direccion" },
  { etiqueta: /^nombre de (alg[uú]n )?contacto[^:]*:\s*/i, campo: "contacto" },
  { etiqueta: /^tel[eé]fono de contacto[^:]*:\s*/i, campo: "telefono" },
  { etiqueta: /^horario laboral[^:]*:\s*/i, campo: "horario" },
];

export type ResultadoParseoXerox = {
  bloques: BloqueXerox[];
  /** números de tarea repetidos dentro del mismo texto pegado. */
  duplicados: string[];
};

export function parsearReporteXerox(texto: string): ResultadoParseoXerox {
  const lineas = String(texto ?? "").replace(/\r\n?/g, "\n").split("\n");

  const bloques: BloqueXerox[] = [];
  const vistos = new Set<string>();
  const duplicados: string[] = [];
  let actual: BloqueXerox | null = null;
  let ubicacion: string | null = null;

  function cerrarActual() {
    if (actual) bloques.push(actual);
    actual = null;
  }

  for (const lineaRaw of lineas) {
    const linea = limpio(lineaRaw);
    if (!linea) {
      // Una línea en blanco separa un bloque del siguiente encabezado/tarea.
      cerrarActual();
      continue;
    }

    const marcaTarea = linea.match(/^\*(\d{4,})\*$/);
    if (marcaTarea) {
      cerrarActual();
      const tarea = marcaTarea[1];
      if (vistos.has(tarea)) duplicados.push(tarea);
      vistos.add(tarea);
      actual = {
        tarea,
        ubicacion,
        modelo: null,
        serie: null,
        cliente: null,
        direccion: null,
        contacto: null,
        telefono: null,
        horario: null,
        falla: null,
      };
      continue;
    }

    if (!actual) {
      // Fuera de un bloque: esta línea es el encabezado de ubicación.
      ubicacion = linea;
      continue;
    }

    const sinPrefijo = sinAdorno(linea);
    let emparejo = false;
    for (const { etiqueta, campo } of CAMPOS) {
      const m = sinPrefijo.match(etiqueta);
      if (m) {
        actual[campo] = limpio(sinPrefijo.slice(m[0].length)) || null;
        emparejo = true;
        break;
      }
    }
    if (!emparejo) {
      actual.falla = actual.falla ? actual.falla + " " + linea : linea;
    }
  }
  cerrarActual();

  return { bloques, duplicados };
}

function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Empareja el encabezado de ubicación del texto pegado ("LOS CABOS", "CD
 * CARMEN"…) con una sucursal real, comparando contra el nombre sin el
 * prefijo de empresa ("Baja Digital Los Cabos" -> "Los Cabos"). `null` si
 * ninguna coincide — el coordinador la elige a mano en el preview.
 */
export function emparejarSucursal<T extends { id: string; nombre: string }>(
  ubicacion: string | null,
  sucursales: T[],
): T | null {
  if (!ubicacion) return null;
  const objetivo = normaliza(ubicacion);
  if (!objetivo) return null;
  for (const s of sucursales) {
    const ciudad = normaliza(s.nombre.replace(/^(alpha|baja) digital\s*/i, ""));
    if (ciudad && (ciudad === objetivo || ciudad.includes(objetivo) || objetivo.includes(ciudad))) {
      return s;
    }
  }
  return null;
}
