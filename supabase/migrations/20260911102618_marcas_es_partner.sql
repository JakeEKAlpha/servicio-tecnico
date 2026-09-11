-- ============================================================================
--  marcas.es_partner — separa "marca del equipo" (fabricante real) de "somos
--  partner oficial de esa marca". Decisión del usuario 2026-09-11: hacen TyM
--  sobre equipos Lexmark, Xerox, HP, etc., pero solo son partner oficial de
--  Lexmark y Xerox. La marca "Propio" (id 299fe1ee-...) sigue existiendo
--  para servicios directos de Alpha Digital sin importar el fabricante real
--  del equipo — no se toca, sigue con es_partner = false.
--
--  100% aditivo: columna nueva (default false, nunca null), una fila nueva
--  (HP). Nada existente cambia de significado.
-- ============================================================================

begin;

alter table "public"."marcas"
  add column if not exists "es_partner" boolean not null default false;

-- Los únicos partners oficiales hoy. IDs de lib/marcas.ts — si se recrea la
-- BD y cambian, hay que actualizar ambos lugares (ya es la convención
-- documentada en ese archivo).
update "public"."marcas" set "es_partner" = true
where "id" in (
  'e54110f0-2f9a-484d-8773-b731e199ebed', -- Lexmark
  'b82bc123-ed93-4f6a-9419-9a29d32f26eb'  -- Xerox
);

-- Primera marca real no-partner, para TyM sobre equipos que no son
-- Lexmark/Xerox. Más marcas (Brother, Epson, ...) se agregan desde
-- /gerencia/marcas conforme aparezcan, no hace falta otra migración.
insert into "public"."marcas" ("nombre", "es_partner")
select 'HP', false
where not exists (select 1 from "public"."marcas" where "nombre" = 'HP');

commit;

-- Verificación rápida tras aplicar:
--   select nombre, es_partner from public.marcas order by es_partner desc, nombre;
--   -- esperado: Lexmark (true), Xerox (true), HP (false), Propio (false)
