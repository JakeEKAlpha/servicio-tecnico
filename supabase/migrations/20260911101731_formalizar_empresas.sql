-- ============================================================================
--  Formaliza "empresa" (Alpha Digital / Baja Digital) como tabla real en vez
--  de texto libre repetido en sucursales/ingenieros y embebido en el nombre
--  de zonas. Decisión del usuario 2026-09-11.
--
--  100% aditivo, como exige docs/analisis-arquitectura-datos.md:
--   - Tabla nueva `empresas`, sin tocar nada existente.
--   - `sucursales.empresa` (texto, CHECK 'alpha'/'baja') se queda igual —
--     sigue siendo lo que usa el resto del código hoy.
--   - `ingenieros.empresa` (texto libre, a veces null) se queda igual.
--   - `zonas.nombre` se queda igual (sigue diciendo "Alpha Digital Zona 1").
--   - Se agrega `empresa_id` (FK nullable) a las tres tablas, backfillado
--     desde el texto que ya existe. Nada se borra, nada cambia de significado.
-- ============================================================================

begin;

create table if not exists "public"."empresas" (
    "id" uuid default gen_random_uuid() not null primary key,
    "nombre" text not null unique,
    "creada_en" timestamp with time zone default now() not null
);

alter table "public"."empresas" enable row level security;

-- Mismo patrón que zonas/marcas: todo authenticated ve el catálogo,
-- solo gerencia lo edita.
create policy "empresas_sel" on "public"."empresas"
  for select to authenticated using (true);
create policy "empresas_ins" on "public"."empresas"
  for insert to authenticated with check ((select public.es_gerencia()));
create policy "empresas_upd" on "public"."empresas"
  for update to authenticated
  using ((select public.es_gerencia()))
  with check ((select public.es_gerencia()));
create policy "empresas_del" on "public"."empresas"
  for delete to authenticated using ((select public.es_gerencia()));

insert into "public"."empresas" ("nombre") values
  ('Alpha Digital'),
  ('Baja Digital')
on conflict ("nombre") do nothing;

-- ---------------------------------------------------------------------------
-- sucursales.empresa_id — backfill desde sucursales.empresa ('alpha'/'baja')
-- ---------------------------------------------------------------------------
alter table "public"."sucursales"
  add column if not exists "empresa_id" uuid references "public"."empresas"("id");

update "public"."sucursales" s
set "empresa_id" = e."id"
from "public"."empresas" e
where s."empresa_id" is null
  and ((s."empresa" = 'alpha' and e."nombre" = 'Alpha Digital')
    or (s."empresa" = 'baja' and e."nombre" = 'Baja Digital'));

-- ---------------------------------------------------------------------------
-- ingenieros.empresa_id — backfill desde ingenieros.empresa (texto libre,
-- algunos en null; esos quedan sin empresa_id, no se inventa un valor).
-- ---------------------------------------------------------------------------
alter table "public"."ingenieros"
  add column if not exists "empresa_id" uuid references "public"."empresas"("id");

update "public"."ingenieros" i
set "empresa_id" = e."id"
from "public"."empresas" e
where i."empresa_id" is null
  and i."empresa" is not null
  and trim(i."empresa") = e."nombre";

-- ---------------------------------------------------------------------------
-- zonas.empresa_id — backfill por prefijo del nombre ("Alpha Digital Zona 1"
-- empieza con "Alpha Digital"; "Baja Digital " recortada es exactamente
-- "Baja Digital"). El nombre de la zona NO se toca.
-- ---------------------------------------------------------------------------
alter table "public"."zonas"
  add column if not exists "empresa_id" uuid references "public"."empresas"("id");

update "public"."zonas" z
set "empresa_id" = e."id"
from "public"."empresas" e
where z."empresa_id" is null
  and trim(z."nombre") like (e."nombre" || '%');

commit;

-- Verificación rápida tras aplicar:
--   select nombre, empresa, empresa_id from public.sucursales order by nombre;
--   select nombre, empresa, empresa_id from public.ingenieros order by nombre;
--   select nombre, empresa_id from public.zonas order by nombre;
-- Todas las filas de sucursales deben quedar con empresa_id; en ingenieros,
-- solo las que ya tenían "empresa" poblado; en zonas, las 3.
