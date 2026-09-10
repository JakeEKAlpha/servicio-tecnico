/**
 * Parseo del reporte WO/SR de Lexmark (texto pegado con tabs, SIN fila de
 * encabezados).
 *
 * El export de harpa siempre entrega las 28 columnas en el mismo orden, así
 * que el mapeo es por POSICIÓN (no por nombre). Lógica de columnas tomada de
 * `importarDesdeHoja()` de 02_Automatizacion.gs.
 *
 * Tipo por fila, según la primera celda:
 *   - "1-XXXXXXXXXXXX" (prefijo "1-")  -> SR / proactiva
 *   - "XXXXXXXX" (solo dígitos)        -> WO
 */

/** Orden fijo de las 28 columnas del reporte (LexmarkCore.COLS_CRUDOS). */
export const COLS_CRUDOS = [
  "Work Order Number", // 0  (o "Service Request" para proactivas)
  "Work Order Type", // 1
  "Sub-Status", // 2
  "Serial Number", // 3
  "Primary Incident Type", // 4
  "Work Order Communication Status", // 5
  "Product", // 6
  "Product Number", // 7
  "Machine Type Model (MTM)", // 8
  "Created On", // 9
  "Customer Committed Response Date", // 10
  "Customer Committed Completion Date", // 11
  "Assigned Resource", // 12
  "Work Order Summary", // 13
  "Customer Reported Problem Code", // 14
  "Service Account", // 15
  "Onsite Contact", // 16
  "Onsite Contact Phone #", // 17
  "Resolve Within", // 18
  "Street 1", // 19
  "Street 2", // 20
  "City", // 21
  "State-Province", // 22
  "Country", // 23
  "Postal Code", // 24
  "Floor", // 25
  "Room", // 26
  "Building", // 27
] as const;

// Índices que SÍ mapean a una columna común de `ordenes` -> NO se repiten en
// `datos_especificos`. "Machine Type Model (MTM)" (8) NO está aquí a propósito:
// aunque respalda `modelo`, el usuario quiere conservarlo siempre.
const IDX_MAPEADOS = new Set([0, 3, 6, 13, 14, 15, 16, 17, 19, 20, 21, 22, 27]);

/** "" o "N/A" (en cualquier caja) se trata como vacío. */
export function esVacio(v: unknown): boolean {
  const s = String(v ?? "").trim();
  return s === "" || s.toUpperCase() === "N/A";
}

export function limpio(v: unknown): string {
  return esVacio(v) ? "" : String(v).trim();
}

function limpioONull(v: unknown): string | null {
  const s = limpio(v);
  return s === "" ? null : s;
}

export type OrigenReporte = "WO" | "SR";

/** Detecta el tipo por la primera celda. `null` si no la reconoce. */
export function detectarOrigen(primeraCelda: string): OrigenReporte | null {
  const s = limpio(primeraCelda);
  if (/^1-\d{6,}$/.test(s)) return "SR"; // 1-XXXXXXXXXXXX
  if (/^\d{6,}$/.test(s)) return "WO"; // XXXXXXXX
  return null;
}

export interface OrdenImportada {
  origen: OrigenReporte;
  numero_orden: string;
  numero_visita: 1;
  cliente: string;
  contacto: string | null;
  tel_fijo: null;
  tel_movil: string | null;
  direccion: string | null;
  localidad: string | null;
  estado: string | null;
  modelo: string | null;
  serie: string | null;
  falla: string | null;
  /** SR (proactiva) arranca esperando piezas; WO arranca "Nuevo". */
  estatus: "Nuevo" | "Pendiente por partes";
  datos_especificos: Record<string, string>;
}

export type ResultadoParseo =
  | { ok: false; error: string }
  | {
      ok: true;
      /** "WO", "SR" o "mixto" según las filas. */
      origen: OrigenReporte | "mixto";
      filas: OrdenImportada[];
      /** filas cuya primera celda no se reconoció como número de orden. */
      ignoradas: number;
    };

export function parsearReporteLexmark(texto: string): ResultadoParseo {
  const lineas = String(texto ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");

  if (lineas.length === 0) {
    return { ok: false, error: "Pega al menos una fila del reporte." };
  }

  const vistos = new Set<string>();
  const filas: OrdenImportada[] = [];
  let ignoradas = 0;

  for (const linea of lineas) {
    const fila = linea.split("\t");
    const celda0 = limpio(fila[0]);

    // Tolerar una fila de encabezados si viene pegada.
    if (celda0 === "Work Order Number" || celda0 === "Service Request") continue;

    if (!celda0) continue;

    const origen = detectarOrigen(celda0);
    if (!origen) {
      ignoradas++;
      continue;
    }
    if (vistos.has(celda0)) continue; // duplicado dentro del mismo pegado
    vistos.add(celda0);

    const at = (i: number) => fila[i];

    const falla =
      origen === "WO"
        ? limpio(at(13)) // Work Order Summary
        : limpio(at(14)); // Customer Reported Problem Code

    const direccion = [at(19), at(20), at(21), at(27)] // Street1, Street2, City, Building
      .map(limpio)
      .filter(Boolean)
      .join(", ");

    const estado = limpio(at(22)) // State-Province
      .replace(/^Mexico\s*\|\s*/i, "")
      .trim();
    const localidad = limpio(at(21)); // City

    let modelo = limpio(at(6)); // Product
    if (!modelo) modelo = limpio(at(8)); // Machine Type Model (MTM)

    const datos_especificos: Record<string, string> = {};
    for (let i = 1; i < COLS_CRUDOS.length; i++) {
      if (IDX_MAPEADOS.has(i)) continue;
      const v = limpio(fila[i]);
      if (v) datos_especificos[COLS_CRUDOS[i]] = v;
    }

    filas.push({
      origen,
      numero_orden: celda0,
      numero_visita: 1,
      cliente: limpio(at(15)), // Service Account (NOT NULL -> "" si falta)
      contacto: limpioONull(at(16)), // Onsite Contact
      tel_fijo: null,
      tel_movil: limpioONull(at(17)), // Onsite Contact Phone #
      direccion: direccion || null,
      localidad: localidad || null,
      estado: estado || null,
      modelo: modelo || null,
      serie: limpioONull(at(3)), // Serial Number
      falla: falla || null,
      estatus: origen === "SR" ? "Pendiente por partes" : "Nuevo",
      datos_especificos,
    });
  }

  const tipos = new Set(filas.map((f) => f.origen));
  const origen: OrigenReporte | "mixto" =
    tipos.size === 1 ? [...tipos][0] : "mixto";

  return { ok: true, origen, filas, ignoradas };
}
