/**
 * IDs de marcas en Supabase (tabla `marcas`).
 *
 * Se usa como constante porque `marcas` tiene RLS de solo lectura para
 * usuarios autenticados; el default se aplica del lado del servidor sin
 * necesidad de consultar. Si se recrea la BD, actualizar aquí.
 */
export const MARCA_LEXMARK_ID = "e54110f0-2f9a-484d-8773-b731e199ebed";
export const MARCA_XEROX_ID = "b82bc123-ed93-4f6a-9419-9a29d32f26eb";
export const MARCA_ALPHA_ID = "299fe1ee-e8ba-40f8-9838-664e12697522";
