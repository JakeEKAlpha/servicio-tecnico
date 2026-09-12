-- Corrige la migración anterior (revocar_execute_anon_helpers_rls): revocar
-- EXECUTE solo de `anon` no bastaba porque Postgres también otorga EXECUTE a
-- la pseudo-rol PUBLIC por default al crear la función, y PUBLIC aplica a
-- absolutamente todos los roles (incluido anon) sin importar el revoke
-- individual. Verificado en vivo: el advisor seguía marcando `anon` después
-- del primer intento.
--
-- Fix real: revocar de PUBLIC y otorgar explícito solo a los roles que sí lo
-- necesitan (`authenticated`, para las políticas RLS que llaman a estas
-- funciones; `service_role`, para el cliente de servicio).

revoke execute on function public.es_gerencia() from public;
revoke execute on function public.es_encargado_de(uuid) from public;
grant execute on function public.es_gerencia() to authenticated, service_role;
grant execute on function public.es_encargado_de(uuid) to authenticated, service_role;
