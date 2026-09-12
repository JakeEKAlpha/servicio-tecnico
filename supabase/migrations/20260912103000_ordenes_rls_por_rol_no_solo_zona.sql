-- Bug real encontrado en producción (2026-09-12, primer uso real de una
-- cuenta `almacen`): las políticas RLS de UPDATE/INSERT en `ordenes` solo
-- comparaban `perfiles.zona_id = ordenes.zona_id` — SIN mirar el rol. Como
-- `almacen` también tiene `zona_id` poblado, pasaba el mismo filtro que un
-- coordinador y podía asignar/reasignar cualquier orden de su zona (el
-- redirect que faltaba en app/(app)/layout.tsx ocultaba el síntoma en la UI,
-- pero el permiso de verdad seguía abierto por RLS).
--
-- Regla correcta:
--   - gerencia/admin: todo (es_gerencia(), sin cambios).
--   - coordinador: su zona, igual que antes — ahora explícito por rol.
--   - ingeniero: SOLO su propia orden asignada (antes tenía, de hecho,
--     acceso a TODA la zona por este mismo hueco — /campo ya lo limitaba a
--     su orden vía guardCampo() a nivel de app, pero RLS no lo exigía).
--   - almacen y cualquier otro rol: sin acceso de escritura a `ordenes`.
--     (SELECT se queda como está: almacén sí necesita leer `sucursal_id` de
--     la orden al validar una pieza — app/api/piezas/[id]/route.ts.)

alter policy "ordenes_upd" on "public"."ordenes"
  using (
    (select public.es_gerencia())
    or exists (
      select 1 from public.perfiles p
      where p.id = auth.uid() and p.rol = 'coordinador' and p.zona_id = ordenes.zona_id
    )
    or exists (
      select 1 from public.perfiles p
      where p.id = auth.uid() and p.rol = 'ingeniero' and p.ingeniero_id = ordenes.ingeniero_id
    )
  )
  with check (
    (select public.es_gerencia())
    or exists (
      select 1 from public.perfiles p
      where p.id = auth.uid() and p.rol = 'coordinador' and p.zona_id = ordenes.zona_id
    )
    or exists (
      select 1 from public.perfiles p
      where p.id = auth.uid() and p.rol = 'ingeniero' and p.ingeniero_id = ordenes.ingeniero_id
    )
  );

alter policy "ordenes_ins" on "public"."ordenes"
  with check (
    (select public.es_gerencia())
    or exists (
      select 1 from public.perfiles p
      where p.id = auth.uid() and p.rol = 'coordinador' and p.zona_id = ordenes.zona_id
    )
  );
