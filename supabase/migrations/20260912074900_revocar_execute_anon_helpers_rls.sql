-- Los security advisors de Supabase marcaron es_gerencia() y
-- es_encargado_de(uuid) como invocables directo por RPC por el rol `anon`
-- (usuarios sin sesión). Son helpers de política RLS (solo leen auth.uid()),
-- así que el riesgo real es bajo, pero no hay razón para que sean públicos:
-- ningún caller legítimo de anon los necesita.
--
-- Importante: NO se revoca de `authenticated` — las políticas RLS que las
-- usan (ej. empresas_ins/upd/del, notificaciones_enviadas_sel/ins) corren
-- como `authenticated` y necesitan poder ejecutarlas. Revocar ahí rompería
-- esas políticas.
--
-- resolver_pieza_no_usada() NO se toca: ya está otorgada solo a
-- `authenticated`/`service_role` (nunca a `anon`) y valida su propio permiso
-- adentro (coordinador de la zona de la orden, o gerencia).

revoke execute on function public.es_gerencia() from anon;
revoke execute on function public.es_encargado_de(uuid) from anon;
