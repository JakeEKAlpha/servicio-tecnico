-- ============================================================================
--  Tabla  preferencias_usuario  — preferencias de UI por usuario
--  Para el panel configurable de /inicio (ver
--  docs/superpowers/specs/2026-09-10-panel-configurable-design.md)
--
--  Correr manualmente en el editor SQL de Supabase (el MCP apply_migration
--  está bloqueado). Es idempotente salvo por las políticas.
-- ============================================================================

create table if not exists public.preferencias_usuario (
  user_id        uuid not null references auth.users (id) on delete cascade,
  clave          text not null,
  valor          jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, clave)
);

alter table public.preferencias_usuario enable row level security;

drop policy if exists "prefs_select_propias" on public.preferencias_usuario;
create policy "prefs_select_propias" on public.preferencias_usuario
  for select using ((select auth.uid()) = user_id);

drop policy if exists "prefs_insert_propias" on public.preferencias_usuario;
create policy "prefs_insert_propias" on public.preferencias_usuario
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "prefs_update_propias" on public.preferencias_usuario;
create policy "prefs_update_propias" on public.preferencias_usuario
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Sin política de DELETE: nadie borra filas por ahora.

comment on table public.preferencias_usuario is
  'Preferencias de interfaz por usuario. clave: inicio_vista | panel_layout.';
