-- ============================================================================
--  ingenieros.sucursal_id — FK formal a sucursales, pendiente de aplicar A MANO
--  (correr en el SQL editor de Supabase; el DDL no se puede automatizar
--   desde el agente en este entorno)
--
--  Qué hace: agrega la columna (nullable, no rompe nada existente) y
--  backfillea por nombre EXACTO contra sucursal (texto) — no es fuzzy-match,
--  porque el campo ya es un <select> en Gerencia, no texto libre.
--
--  `ingenieros.sucursal` (texto) sigue siendo lo que usa la asignación de
--  órdenes hoy — esto no lo reemplaza, solo formaliza la referencia.
-- ============================================================================

begin;

alter table public.ingenieros
  add column if not exists sucursal_id uuid references public.sucursales(id);

update public.ingenieros i
set sucursal_id = s.id
from public.sucursales s
where i.sucursal_id is null
  and i.sucursal is not null
  and s.nombre = i.sucursal;

commit;

-- Verificación rápida tras aplicar:
--   select sucursal, sucursal_id, count(*) from public.ingenieros
--   group by 1, 2 order by 1;
-- Revisa a mano cualquier fila con sucursal_id NULL y sucursal no vacío —
-- es un typo en el texto o una sucursal que aún no existe en `sucursales`.
