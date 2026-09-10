import { Readable } from "node:stream";
import type { SupabaseClient } from "@supabase/supabase-js";
import { driveClient, docsClient } from "@/lib/google/cliente";
import { fmtFechaDoc, fmtHoraDoc, yyyyMmDesdeFecha } from "@/lib/documentos/formato";

/**
 * Genera el Doc + PDF de una orden a partir de la plantilla de Google Docs.
 * Réplica de `generarDocumentoDesdeDatosDocumento()` de 03_GeneracionDocs.gs,
 * sin la hoja intermedia DATOS_DOCUMENTO: se lee directo de `ordenes`.
 *
 * - `supabase` debe estar autenticado como el usuario (RLS decide qué órdenes ve).
 * - Las operaciones de Google usan la cuenta de servicio.
 *
 * Devuelve { link_doc, link_pdf } y ya los deja guardados en la orden.
 * Lanza Error con mensaje claro si falta algún requisito.
 */

export class ErrorGeneracion extends Error {}

export async function generarDocumento(
  supabase: SupabaseClient,
  ordenId: string,
): Promise<{ link_doc: string; link_pdf: string }> {
  const plantillaId = process.env.GOOGLE_DOC_TEMPLATE_ID;
  if (!plantillaId) {
    throw new ErrorGeneracion("Falta GOOGLE_DOC_TEMPLATE_ID en el entorno.");
  }

  // 1) Leer la orden (RLS la filtra por zona)
  const { data: orden, error: ordenError } = await supabase
    .from("ordenes")
    .select("*")
    .eq("id", ordenId)
    .maybeSingle();
  if (ordenError) {
    throw new ErrorGeneracion("No se pudo leer la orden.");
  }
  if (!orden) {
    throw new ErrorGeneracion("Orden no encontrada.");
  }

  // 2) Validaciones (mismas que el original)
  if (!orden.numero_orden) {
    throw new ErrorGeneracion("La orden no tiene número.");
  }
  if (!orden.ingeniero_id) {
    throw new ErrorGeneracion(
      "Sin técnico responsable — no se genera documento.",
    );
  }
  if (!orden.fecha_eta) {
    throw new ErrorGeneracion("Sin Fecha ETA — no se genera documento.");
  }

  // 3) Ingeniero (nombre + nombre corto) y carpeta de la zona
  const { data: ingeniero, error: ingError } = await supabase
    .from("ingenieros")
    .select("nombre, nombre_corto")
    .eq("id", orden.ingeniero_id)
    .maybeSingle();
  if (ingError || !ingeniero) {
    throw new ErrorGeneracion("No se pudo leer el ingeniero de la orden.");
  }

  const { data: zona, error: zonaError } = await supabase
    .from("zonas")
    .select("drive_folder_id")
    .eq("id", orden.zona_id)
    .maybeSingle();
  if (zonaError || !zona) {
    throw new ErrorGeneracion("No se pudo leer la zona de la orden.");
  }
  if (!zona.drive_folder_id) {
    throw new ErrorGeneracion(
      "La zona no tiene carpeta de Drive configurada (zonas.drive_folder_id).",
    );
  }

  const drive = driveClient();
  const docs = docsClient();

  // 4) Ruta de carpetas: zona / nombre_corto / AAAA-MM
  const nombreCorto =
    (ingeniero.nombre_corto as string | null)?.trim() ||
    String(ingeniero.nombre ?? "").split(" ")[0] ||
    "SinIngeniero";
  const yyyyMm = yyyyMmDesdeFecha(orden.fecha_eta as string);

  const folderIng = await obtenerOCrearCarpeta(
    drive,
    zona.drive_folder_id as string,
    nombreCorto,
  );
  const folderMes = await obtenerOCrearCarpeta(drive, folderIng, yyyyMm);

  // 5) Borrar Doc/PDF anteriores (si existen)
  await borrarPorUrl(drive, orden.link_doc as string | null);
  await borrarPorUrl(drive, orden.link_pdf as string | null);

  // 6) Copiar la plantilla
  const cliente = String(orden.cliente || "SinCliente")
    .trim()
    .substring(0, 40);
  const fileName = `${orden.numero_orden} - ${cliente} - ${nombreCorto}`;

  const copia = await drive.files.copy({
    fileId: plantillaId,
    requestBody: { name: fileName, parents: [folderMes] },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  const docId = copia.data.id as string;
  const docUrl =
    (copia.data.webViewLink as string | undefined) ??
    `https://docs.google.com/document/d/${docId}/edit`;

  // 7) Reemplazar los 16 marcadores
  const tipo = orden.origen === "SR" ? "SR" : "WO";
  const ciudadEstado = orden.localidad
    ? `${orden.localidad}${orden.estado ? `, ${orden.estado}` : ""}`
    : String(orden.estado ?? "");

  const reemplazos: Record<string, string> = {
    "{{FechaETA}}": fmtFechaDoc(orden.fecha_eta as string),
    "{{HoraETA}}": fmtHoraDoc(orden.hora_eta as string | null),
    "{{Cliente}}": String(orden.cliente ?? ""),
    "{{NumeroSRLabel}}": tipo === "SR" ? "Núm. SR" : "Núm. WO",
    "{{NumeroSRValor}}": String(orden.numero_orden ?? ""),
    "{{PersonaContacto}}": String(orden.contacto ?? ""),
    "{{TelefonoFijo}}": String(orden.tel_fijo ?? ""),
    "{{TelefonoMovil}}": String(orden.tel_movil ?? ""),
    "{{Direccion}}": String(orden.direccion ?? ""),
    "{{CiudadEstado}}": ciudadEstado,
    "{{Modelo}}": String(orden.modelo ?? ""),
    "{{NumeroSerie}}": String(orden.serie ?? ""),
    "{{FallaReportada}}": String(orden.falla ?? ""),
    "{{ChkCorrectivo}}": tipo === "WO" ? "☑" : "☐",
    "{{ChkPreventivo}}": tipo === "SR" ? "☑" : "☐",
    "{{TecnicoResponsable}}": String(ingeniero.nombre ?? ""),
  };

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: Object.entries(reemplazos).map(([marcador, valor]) => ({
        replaceAllText: {
          containsText: { text: marcador, matchCase: true },
          replaceText: valor,
        },
      })),
    },
  });

  // 8) Exportar a PDF y guardarlo junto al Doc
  const pdfExport = await drive.files.export(
    { fileId: docId, mimeType: "application/pdf" },
    { responseType: "arraybuffer" },
  );
  const pdfBuffer = Buffer.from(pdfExport.data as ArrayBuffer);

  const pdfFile = await drive.files.create({
    requestBody: {
      name: `${fileName}.pdf`,
      parents: [folderMes],
      mimeType: "application/pdf",
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(pdfBuffer),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  const pdfId = pdfFile.data.id as string;
  const pdfUrl =
    (pdfFile.data.webViewLink as string | undefined) ??
    `https://drive.google.com/file/d/${pdfId}/view`;

  // 9) Guardar los links en la orden
  const { error: updError } = await supabase
    .from("ordenes")
    .update({ link_doc: docUrl, link_pdf: pdfUrl })
    .eq("id", ordenId);
  if (updError) {
    throw new ErrorGeneracion(
      "El documento se generó pero no se pudo guardar el link en la orden: " +
        updError.message,
    );
  }

  return { link_doc: docUrl, link_pdf: pdfUrl };
}

// ---------------------------------------------------------------------------
// Helpers de Drive
// ---------------------------------------------------------------------------

type Drive = ReturnType<typeof driveClient>;

/** Get-or-create de una subcarpeta por nombre. (`_obtenerOCrearCarpeta`) */
async function obtenerOCrearCarpeta(
  drive: Drive,
  parentId: string,
  nombre: string,
): Promise<string> {
  const nombreEscapado = nombre.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${nombreEscapado}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id as string;
  }
  const creada = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return creada.data.id as string;
}

/** Manda a la papelera el archivo referenciado por una URL de Drive/Docs. */
async function borrarPorUrl(drive: Drive, url: string | null): Promise<void> {
  if (!url) return;
  const m = String(url).match(/[-\w]{25,}/);
  if (!m) return;
  try {
    await drive.files.update({
      fileId: m[0],
      requestBody: { trashed: true },
      supportsAllDrives: true,
    });
  } catch {
    // Si ya no existe o no se puede borrar, seguimos.
  }
}
