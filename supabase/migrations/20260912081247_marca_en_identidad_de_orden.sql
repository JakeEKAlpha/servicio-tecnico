-- `numero_orden` lo asigna cada fabricante por separado (Lexmark, Xerox) sin
-- prefijo que los distinga. El UNIQUE actual (zona_id, numero_orden,
-- numero_visita) y la cascada de "Concluido" tratan (zona, numero_orden)
-- como si fuera la identidad completa del caso — dos marcas distintas
-- podrían coincidir en el mismo número algún día. Verificado en vivo
-- (2026-09-12): hoy no hay ninguna colisión real, así que este cambio es
-- seguro de aplicar ahora.
--
-- Esta migración agrega marca_id a esa identidad en los dos lugares donde
-- importa: la restricción de unicidad y la cascada.

alter table public.ordenes
  drop constraint ordenes_zona_id_numero_orden_numero_visita_key;

alter table public.ordenes
  add constraint ordenes_zona_id_marca_id_numero_orden_numero_visita_key
  unique (zona_id, marca_id, numero_orden, numero_visita);

create or replace function public.fn_cascada_concluido() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
begin
  if new.estatus = 'Concluido' and old.estatus is distinct from 'Concluido' then
    update ordenes set estatus = 'Concluido'
    where zona_id = new.zona_id and numero_orden = new.numero_orden
      and marca_id = new.marca_id
      and id <> new.id and estatus <> 'Cancelado';
  end if;
  return new;
end;
$$;
