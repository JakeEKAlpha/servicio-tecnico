import { auth } from "@googleapis/drive";
import { drive as driveApi } from "@googleapis/drive";
import { docs as docsApi } from "@googleapis/docs";

/**
 * Cliente de Google (Drive + Docs) autenticado con la cuenta de servicio.
 *
 * La llave va en la variable de entorno GOOGLE_SERVICE_ACCOUNT_KEY como el
 * JSON completo en una sola línea. NUNCA se commitea.
 *
 * La cuenta de servicio necesita acceso (compartido como Editor) a:
 *  - la plantilla (Google Doc), y
 *  - la(s) carpeta(s) de Drive donde se guardan los documentos.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive",
];

function credenciales() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64) {
    throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_KEY_B64 en el entorno.");
  }
  try {
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json) as { client_email: string; private_key: string };
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY_B64 no decodifica a JSON válido (debe ser el archivo .json completo, codificado en base64).",
    );
  }
}

function googleAuth() {
  const cred = credenciales();
  // Domain-wide delegation: la cuenta de servicio NO tiene almacenamiento
  // propio en Drive (limit = 0), así que actúa "en nombre de" un usuario real
  // de Google Workspace. Los documentos generados quedan a nombre de ese
  // usuario, que sí tiene almacenamiento.
  const subject = process.env.GOOGLE_IMPERSONATE_USER || undefined;
  return new auth.JWT({
    email: cred.client_email,
    key: cred.private_key,
    scopes: SCOPES,
    subject,
  });
}

export function driveClient() {
  return driveApi({ version: "v3", auth: googleAuth() });
}

export function docsClient() {
  return docsApi({ version: "v1", auth: googleAuth() });
}
