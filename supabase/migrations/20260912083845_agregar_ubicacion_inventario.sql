-- Encontrado corriendo la app de verdad (dev server contra Supabase real,
-- 2026-09-12): GET /api/inventario y PATCH /api/inventario/:id llevan meses
-- de código (route handlers, AlmacenPiezas.tsx, almacen/page.tsx) leyendo y
-- escribiendo `inventario.ubicacion` — la columna nunca existió en la BD.
-- A diferencia del bug de ingenieros/sucursales (código viejo apuntando a
-- una columna que SÍ existió y se borró a propósito), este es el caso
-- contrario: la funcionalidad es real e intencional (ubicación física de la
-- pieza dentro del almacén, editable en el panel), simplemente nunca se
-- migró la columna. Consistente con que `inventario`/`almacen` nunca ha
-- tenido un usuario real con rol `almacen` probándolo (ver auditoría
-- 2026-09-12: 0 perfiles con ese rol en producción).

alter table public.inventario
  add column if not exists ubicacion text;
