-- ============================================================================
--  Notificaciones push (Web Push / PWA). Decisión del usuario 2026-09-11.
--  Ver ARQUITECTURA.md para la tabla completa de los 13 disparadores
--  (4 por evento, 9 revisados por el cron cada 15 min vía cron-job.org).
--
--  push_subscripciones: una suscripción de navegador por dispositivo. Un
--  perfil puede tener varias (celular + otro dispositivo).
--
--  notificaciones_enviadas: dedup para los disparadores PROGRAMADOS — sin
--  esto, una condición que sigue siendo cierta (ej. "sin marcar salida")
--  mandaría el mismo push cada 15 minutos para siempre. Los disparadores
--  por EVENTO (asignación, pieza apartada/arribo, nuevo servicio) no la
--  necesitan — se disparan una sola vez, inline, desde el código que ya
--  hace esa acción.
-- ============================================================================

begin;

create table if not exists "public"."push_subscripciones" (
    "id" uuid default gen_random_uuid() not null primary key,
    "perfil_id" uuid not null references "public"."perfiles"("id") on delete cascade,
    "endpoint" text not null unique,
    "p256dh" text not null,
    "auth_key" text not null,
    "creada_en" timestamp with time zone default now() not null
);

create index if not exists "push_subscripciones_perfil_id_idx"
  on "public"."push_subscripciones" ("perfil_id");

alter table "public"."push_subscripciones" enable row level security;

-- Cualquier authenticated puede leer (el código que dispara una notificación
-- casi siempre es un usuario DISTINTO al destinatario — un coordinador
-- asignando dispara el push del ingeniero, por ejemplo). El endpoint en sí
-- no es secreto-crítico del mismo modo que una contraseña.
create policy "push_subscripciones_sel" on "public"."push_subscripciones"
  for select to authenticated using (true);

-- Cada quien administra solo su propia suscripción.
create policy "push_subscripciones_ins" on "public"."push_subscripciones"
  for insert to authenticated
  with check ((select auth.uid()) = perfil_id);
create policy "push_subscripciones_del" on "public"."push_subscripciones"
  for delete to authenticated
  using ((select auth.uid()) = perfil_id);

create table if not exists "public"."notificaciones_enviadas" (
    "id" uuid default gen_random_uuid() not null primary key,
    "tipo" text not null,
    -- Clave de dedup: identifica de forma única qué combinación
    -- (tipo + orden/ingeniero + ventana de tiempo) ya se avisó. Ej.:
    --   'eta_sin_inicio:<orden_id>'
    --   'cronico:<ingeniero_id>:2026-W37'
    --   'resumen_5pm:2026-09-11'
    "clave" text not null,
    "destinatario_perfil_id" uuid references "public"."perfiles"("id") on delete cascade,
    "enviada_en" timestamp with time zone default now() not null,
    unique ("tipo", "clave", "destinatario_perfil_id")
);

alter table "public"."notificaciones_enviadas" enable row level security;

-- El endpoint del cron corre con la service role key (ver
-- lib/push/cliente-servidor.ts) y esa clave se salta RLS por completo — esta
-- política solo importa para cualquier OTRO llamador con sesión normal.
create policy "notificaciones_enviadas_sel" on "public"."notificaciones_enviadas"
  for select to authenticated using ((select public.es_gerencia()));
create policy "notificaciones_enviadas_ins" on "public"."notificaciones_enviadas"
  for insert to authenticated with check ((select public.es_gerencia()));

commit;
