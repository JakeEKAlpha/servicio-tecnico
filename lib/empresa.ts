/**
 * Datos de la empresa operadora, distintos por zona / coordinador:
 *   - Zona 1 y Zona 2  → Alpha Digital
 *   - Baja Digital      → Baja Digital
 *
 * Se usan en el encabezado (logo) y en el pie de página de la app.
 * A futuro estos datos se editarán desde el Panel de Gerencia; por ahora
 * viven aquí como configuración.
 *
 * TODO(usuario): confirmar teléfono / correo de Baja Digital.
 */

export type Empresa = {
  clave: "alpha" | "baja";
  nombre: string;
  lema: string;
  telefono: string;
  correo: string;
};

export const EMPRESA_ALPHA: Empresa = {
  clave: "alpha",
  nombre: "Alpha Digital",
  lema: "Servicio Técnico Especializado en Impresión",
  telefono: "(999) 233-7391",
  correo: "coordinacion@alphadigital.com.mx",
};

export const EMPRESA_BAJA: Empresa = {
  clave: "baja",
  nombre: "Baja Digital",
  lema: "Servicio Técnico Especializado en Impresión",
  telefono: "(999) 233-7391", // TODO: confirmar
  correo: "coordinacion@alphadigital.com.mx", // TODO: confirmar
};

/** Elige la empresa según el nombre de la zona ("Baja Digital" → Baja). */
export function empresaDeZona(zonaNombre: string | null | undefined): Empresa {
  return String(zonaNombre ?? "")
    .toLowerCase()
    .includes("baja")
    ? EMPRESA_BAJA
    : EMPRESA_ALPHA;
}
