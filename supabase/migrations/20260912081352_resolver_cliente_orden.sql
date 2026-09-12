-- `ordenes.cliente_id` hoy solo se llena si quien llama a la API lo manda
-- explícito (selector de ModalNuevaOrden, o el backfill de una sola vez de
-- /gerencia/cuentas). Cualquier punto de entrada que no lo mande (ej. el
-- importador de Lexmark) deja la orden sin vincular hasta que alguien la
-- arregle a mano.
--
-- Esta migración agrega una red de seguridad a nivel de BD, pero
-- DELIBERADAMENTE acotada: solo resuelve coincidencia EXACTA (mismo texto,
-- normalizando mayúsculas/espacios), nunca difusa.
--
-- Por qué no se porta el emparejamiento difuso completo (`cuentaDeOrden` /
-- `mejorCoincidenciaCliente` en lib/cuentas/directorio.ts) a este trigger:
-- ese algoritmo quita razón social (S.A. DE C.V., etc.), acentos y usa
-- puntaje por coincidencia parcial de palabras — está probado con casos
-- reales (incluido el de DHL EXPRESS vs DHL METROPOLITAN) en
-- lib/cuentas/directorio.test.ts. Reimplementar esa heurística en SQL, sin
-- los mismos tests corriendo contra ella, arriesga que diverja en un caso
-- borde y vincule una orden al cliente equivocado EN SILENCIO en el
-- momento del insert — peor que dejarla sin vincular (que hoy se resuelve
-- con un humano viendo el selector o el backfill). El emparejamiento difuso
-- se queda donde está probado: en la aplicación.

create or replace function public.fn_resolver_cliente_orden() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
begin
  if new.cliente_id is null and new.cliente is not null and btrim(new.cliente) <> '' then
    select id into new.cliente_id from public.clientes
    where activo = true
      and upper(regexp_replace(btrim(nombre), '\s+', ' ', 'g'))
        = upper(regexp_replace(btrim(new.cliente), '\s+', ' ', 'g'))
    limit 1;
  end if;
  return new;
end $$;

create or replace trigger trg_resolver_cliente_orden
  before insert on public.ordenes
  for each row execute function public.fn_resolver_cliente_orden();
