-- ============================================================================
--  Optimización de políticas RLS — pendiente de aplicar A MANO
--  (el classifier de auto-mode de Claude bloquea DROP/ALTER POLICY sobre las
--   tablas por-zona; correr esto en el SQL editor de Supabase y verificar
--   inmediatamente que el tablero sigue cargando)
--
--  Qué hace: envuelve auth.uid() y es_gerencia() en (select …) para que se
--  evalúen UNA vez por consulta en vez de por fila (advisor auth_rls_initplan,
--  14 findings), fija el rol a `authenticated`, y unifica las políticas SELECT
--  duplicadas de ingenieros / inventario / perfiles.
--
--  Semántica de permisos: IDÉNTICA a la actual. Regla de negocio sin cambios:
--   · gerencia/admin ven y editan todo
--   · coordinador ve/edita lo de su zona
--   · encargado de almacén gestiona su(s) sucursal(es)
-- ============================================================================

begin;

-- ---------- perfiles ----------
drop policy if exists ver_propio_perfil   on public.perfiles;
drop policy if exists gerencia_ve_perfiles on public.perfiles;
create policy perfiles_sel on public.perfiles for select to authenticated
  using ((select auth.uid()) = id or (select public.es_gerencia()));
-- gerencia_edita_perfiles (UPDATE) se deja como está.

-- ---------- ingenieros ----------
drop policy if exists ver_ingenieros_por_zona    on public.ingenieros;
drop policy if exists gerencia_gestiona_ingenieros on public.ingenieros;
create policy ingenieros_sel on public.ingenieros for select to authenticated
  using (
    (select public.es_gerencia())
    or exists (select 1 from public.perfiles p
               where p.id = (select auth.uid()) and p.zona_id = ingenieros.zona_id)
  );
create policy ingenieros_ins on public.ingenieros for insert to authenticated
  with check ((select public.es_gerencia()));
create policy ingenieros_upd on public.ingenieros for update to authenticated
  using ((select public.es_gerencia())) with check ((select public.es_gerencia()));
create policy ingenieros_del on public.ingenieros for delete to authenticated
  using ((select public.es_gerencia()));

-- ---------- ordenes ----------
drop policy if exists ver_ordenes_por_zona    on public.ordenes;
drop policy if exists crear_ordenes_por_zona  on public.ordenes;
drop policy if exists editar_ordenes_por_zona on public.ordenes;
create policy ordenes_sel on public.ordenes for select to authenticated
  using (
    (select public.es_gerencia())
    or exists (select 1 from public.perfiles p
               where p.id = (select auth.uid()) and p.zona_id = ordenes.zona_id)
  );
create policy ordenes_ins on public.ordenes for insert to authenticated
  with check (
    (select public.es_gerencia())
    or exists (select 1 from public.perfiles p
               where p.id = (select auth.uid()) and p.zona_id = ordenes.zona_id)
  );
create policy ordenes_upd on public.ordenes for update to authenticated
  using (
    (select public.es_gerencia())
    or exists (select 1 from public.perfiles p
               where p.id = (select auth.uid()) and p.zona_id = ordenes.zona_id)
  )
  with check (
    (select public.es_gerencia())
    or exists (select 1 from public.perfiles p
               where p.id = (select auth.uid()) and p.zona_id = ordenes.zona_id)
  );

-- ---------- ordenes_historial ----------
drop policy if exists ver_historial_por_zona on public.ordenes_historial;
create policy ordenes_historial_sel on public.ordenes_historial for select to authenticated
  using (
    (select public.es_gerencia())
    or exists (select 1 from public.ordenes o
               join public.perfiles p on p.id = (select auth.uid())
               where o.id = ordenes_historial.orden_id and p.zona_id = o.zona_id)
  );

-- ---------- piezas_orden ----------
drop policy if exists ver_piezas_orden    on public.piezas_orden;
drop policy if exists crear_piezas_orden  on public.piezas_orden;
drop policy if exists editar_piezas_orden on public.piezas_orden;
drop policy if exists borrar_piezas_orden on public.piezas_orden;
create policy piezas_orden_sel on public.piezas_orden for select to authenticated
  using (
    (select public.es_gerencia())
    or exists (select 1 from public.ordenes o
               join public.perfiles p on p.id = (select auth.uid())
               where o.id = piezas_orden.orden_id and p.zona_id = o.zona_id)
  );
create policy piezas_orden_ins on public.piezas_orden for insert to authenticated
  with check (
    (select public.es_gerencia())
    or exists (select 1 from public.ordenes o
               join public.perfiles p on p.id = (select auth.uid())
               where o.id = piezas_orden.orden_id and p.zona_id = o.zona_id)
  );
create policy piezas_orden_upd on public.piezas_orden for update to authenticated
  using (
    (select public.es_gerencia())
    or exists (select 1 from public.ordenes o
               join public.perfiles p on p.id = (select auth.uid())
               where o.id = piezas_orden.orden_id and p.zona_id = o.zona_id)
  )
  with check (
    (select public.es_gerencia())
    or exists (select 1 from public.ordenes o
               join public.perfiles p on p.id = (select auth.uid())
               where o.id = piezas_orden.orden_id and p.zona_id = o.zona_id)
  );
create policy piezas_orden_del on public.piezas_orden for delete to authenticated
  using (
    (select public.es_gerencia())
    or exists (select 1 from public.ordenes o
               join public.perfiles p on p.id = (select auth.uid())
               where o.id = piezas_orden.orden_id and p.zona_id = o.zona_id)
  );

-- ---------- inventario ----------
drop policy if exists ver_inventario     on public.inventario;
drop policy if exists gestiona_inventario on public.inventario;
create policy inventario_sel on public.inventario for select to authenticated
  using (
    (select public.es_gerencia())
    or (select public.es_encargado_de(sucursal_id))
    or exists (select 1 from public.sucursales s
               join public.perfiles p on p.id = (select auth.uid())
               where s.id = inventario.sucursal_id and s.zona_id = p.zona_id)
  );
create policy inventario_ins on public.inventario for insert to authenticated
  with check ((select public.es_gerencia()) or (select public.es_encargado_de(sucursal_id)));
create policy inventario_upd on public.inventario for update to authenticated
  using ((select public.es_gerencia()) or (select public.es_encargado_de(sucursal_id)))
  with check ((select public.es_gerencia()) or (select public.es_encargado_de(sucursal_id)));
create policy inventario_del on public.inventario for delete to authenticated
  using ((select public.es_gerencia()) or (select public.es_encargado_de(sucursal_id)));

-- ---------- movimientos_inventario ----------
drop policy if exists ver_movimientos  on public.movimientos_inventario;
drop policy if exists crea_movimientos on public.movimientos_inventario;
create policy movimientos_sel on public.movimientos_inventario for select to authenticated
  using (
    (select public.es_gerencia())
    or (select public.es_encargado_de(sucursal_id))
    or exists (select 1 from public.sucursales s
               join public.perfiles p on p.id = (select auth.uid())
               where s.id = movimientos_inventario.sucursal_id and s.zona_id = p.zona_id)
  );
create policy movimientos_ins on public.movimientos_inventario for insert to authenticated
  with check ((select public.es_gerencia()) or (select public.es_encargado_de(sucursal_id)));

-- ---------- evidencias ----------
drop policy if exists ver_evidencias  on public.evidencias;
drop policy if exists crea_evidencias on public.evidencias;
create policy evidencias_sel on public.evidencias for select to authenticated
  using (
    exists (select 1 from public.ordenes o
            join public.perfiles p on p.id = (select auth.uid())
            where o.id = evidencias.orden_id
              and ((select public.es_gerencia()) or p.zona_id = o.zona_id))
  );
create policy evidencias_ins on public.evidencias for insert to authenticated
  with check (
    exists (select 1 from public.ordenes o
            join public.perfiles p on p.id = (select auth.uid())
            where o.id = evidencias.orden_id
              and ((select public.es_gerencia()) or p.zona_id = o.zona_id))
  );

commit;

-- Verificación rápida tras aplicar:
--   select * from public.ordenes limit 1;                       -- como coordinador
--   select tablename, count(*) from pg_policies where schemaname='public' group by 1;
