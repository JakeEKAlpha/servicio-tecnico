


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."Tipos de piezas" AS ENUM (
    'Pieza',
    'Kit'
);


ALTER TYPE "public"."Tipos de piezas" OWNER TO "postgres";


COMMENT ON TYPE "public"."Tipos de piezas" IS 'Tipos de piezas simples o compuestas';



CREATE TYPE "public"."estatus_orden" AS ENUM (
    'Nuevo',
    'Pendiente',
    'Asignado',
    'Reagendado',
    'Pendiente por partes',
    'Concluido',
    'Cancelado',
    'Lista para realizar',
    'Listo para continuar'
);


ALTER TYPE "public"."estatus_orden" OWNER TO "postgres";


CREATE TYPE "public"."rol_usuario" AS ENUM (
    'coordinador',
    'ingeniero',
    'gerencia',
    'admin',
    'almacen'
);


ALTER TYPE "public"."rol_usuario" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."es_encargado_de"("suc" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.encargados_almacen e
    where e.perfil_id = auth.uid() and e.sucursal_id = suc
  );
$$;


ALTER FUNCTION "public"."es_encargado_de"("suc" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."es_gerencia"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists(select 1 from public.perfiles where id = auth.uid() and rol in ('gerencia','admin'));
$$;


ALTER FUNCTION "public"."es_gerencia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_aplicar_movimiento"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.inventario (numero_parte, sucursal_id, cantidad_disponible)
  values (new.numero_parte, new.sucursal_id, 0)
  on conflict (numero_parte, sucursal_id) do nothing;

  update public.inventario set
    cantidad_disponible = case new.tipo
      when 'entrada' then cantidad_disponible + new.cantidad
      when 'salida'  then greatest(0, cantidad_disponible - new.cantidad)
      when 'ajuste'  then new.cantidad
      when 'apartar' then greatest(0, cantidad_disponible - new.cantidad)
      when 'liberar' then cantidad_disponible + new.cantidad
      else cantidad_disponible          -- 'usar' no toca disponible
    end,
    cantidad_apartada = case new.tipo
      when 'apartar' then cantidad_apartada + new.cantidad
      when 'liberar' then greatest(0, cantidad_apartada - new.cantidad)
      when 'usar'    then greatest(0, cantidad_apartada - new.cantidad)
      else cantidad_apartada
    end,
    actualizado_en = now()
  where numero_parte = new.numero_parte and sucursal_id = new.sucursal_id;
  return new;
end $$;


ALTER FUNCTION "public"."fn_aplicar_movimiento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cascada_concluido"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.estatus = 'Concluido' and old.estatus is distinct from 'Concluido' then
    update ordenes set estatus = 'Concluido'
    where zona_id = new.zona_id and numero_orden = new.numero_orden
      and id <> new.id and estatus <> 'Cancelado';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_cascada_concluido"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_pieza_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_suc uuid;
  v_ant text := coalesce(old.estado, '');
begin
  select sucursal_id into v_suc from public.ordenes where id = new.orden_id;
  if v_suc is null then
    return new;
  end if;

  if new.estado = 'apartada' and v_ant <> 'apartada' then
    insert into public.movimientos_inventario (sucursal_id, numero_parte, tipo, cantidad, motivo, orden_id)
      values (v_suc, new.numero_parte, 'apartar', new.cantidad, 'Apartada para WO', new.orden_id);
    new.apartada_en := now();

  elsif new.estado = 'usada' and v_ant <> 'usada' then
    insert into public.movimientos_inventario (sucursal_id, numero_parte, tipo, cantidad, motivo, orden_id)
      values (v_suc, new.numero_parte, 'usar', new.cantidad, 'Uso confirmado', new.orden_id);
    new.usada_en := now();
    if not new.es_reposicion then
      insert into public.piezas_orden (orden_id, numero_parte, descripcion, estado, cantidad, es_reposicion)
        values (new.orden_id, new.numero_parte, new.descripcion, 'en_espera', new.cantidad, true);
    end if;

  elsif new.estado = 'recibida' and v_ant = 'en_espera' then
    insert into public.movimientos_inventario (sucursal_id, numero_parte, tipo, cantidad, motivo, orden_id)
      values (v_suc, new.numero_parte, 'entrada', new.cantidad, 'Arribo de reposición', new.orden_id);
  end if;

  return new;
end $$;


ALTER FUNCTION "public"."fn_pieza_stock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_piezas_arribo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_orden ordenes%rowtype;
  v_en_espera int;
  v_recibidas int;
  v_lexmark uuid := 'e54110f0-2f9a-484d-8773-b731e199ebed';
begin
  if new.estado <> 'recibida' then
    return new;
  end if;

  select * into v_orden from ordenes where id = new.orden_id;
  if not found then return new; end if;
  if v_orden.marca_id is distinct from v_lexmark then return new; end if;

  select
    count(*) filter (where estado = 'en_espera'),
    count(*) filter (where estado = 'recibida')
  into v_en_espera, v_recibidas
  from piezas_orden where orden_id = new.orden_id;

  if v_en_espera > 0 or v_recibidas = 0 then
    return new;
  end if;

  if v_orden.estatus = 'Pendiente por partes' then
    if v_orden.ingeniero_id is null and v_orden.fecha_eta is null then
      update ordenes set estatus = 'Lista para realizar' where id = v_orden.id;
    else
      update ordenes set estatus = 'Listo para continuar'
      where zona_id = v_orden.zona_id
        and numero_orden = v_orden.numero_orden
        and numero_visita = coalesce(v_orden.numero_visita, 1) + 1
        and estatus = 'Pendiente';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."fn_piezas_arribo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_registrar_historial"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.estatus is distinct from new.estatus then
    insert into ordenes_historial(orden_id, estatus_anterior, estatus_nuevo, usuario_id)
    values (new.id, old.estatus, new.estatus, auth.uid());
  end if;
  new.actualizado_en = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_registrar_historial"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_resolver_sucursal_orden"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.sucursal_id is null and new.sucursal is not null and btrim(new.sucursal) <> '' then
    select id into new.sucursal_id from public.sucursales
    where lower(nombre) = lower(btrim(new.sucursal))
       or lower(ciudad) = lower(btrim(new.sucursal))
    limit 1;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."fn_resolver_sucursal_orden"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."password_cambiada"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.perfiles set debe_cambiar_password = false where id = auth.uid();
$$;


ALTER FUNCTION "public"."password_cambiada"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."piezas_orden" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_id" "uuid" NOT NULL,
    "numero_parte" "text" NOT NULL,
    "descripcion" "text",
    "estado" "text" DEFAULT 'recomendada'::"text" NOT NULL,
    "creada_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recibida_en" timestamp with time zone,
    "recibida_por" "uuid",
    "cantidad" integer DEFAULT 1 NOT NULL,
    "apartada_en" timestamp with time zone,
    "usada_en" timestamp with time zone,
    "es_reposicion" boolean DEFAULT false NOT NULL,
    "validada_almacen" boolean DEFAULT false NOT NULL,
    "disponible_sistema" boolean DEFAULT false NOT NULL,
    CONSTRAINT "piezas_orden_estado_check" CHECK (("estado" = ANY (ARRAY['recomendada'::"text", 'en_espera'::"text", 'recibida'::"text", 'cancelada'::"text", 'apartada'::"text", 'usada'::"text"])))
);


ALTER TABLE "public"."piezas_orden" OWNER TO "postgres";


COMMENT ON COLUMN "public"."piezas_orden"."disponible_sistema" IS 'Validación 1/2 (sistema): el coordinador confirma que hay existencia en el sistema (o override si stock=0). La 2/2 es validada_almacen (físico).';



CREATE OR REPLACE FUNCTION "public"."resolver_pieza_no_usada"("p_pieza" "uuid", "p_modo" "text") RETURNS "public"."piezas_orden"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_pieza public.piezas_orden;
  v_suc uuid;
  v_tipo text;
  v_motivo text;
  v_nuevo_estado text;
begin
  select * into v_pieza from public.piezas_orden where id = p_pieza;
  if not found then raise exception 'Pieza no encontrada'; end if;

  -- autorización: coordinador de la zona de la orden o gerencia
  if not exists (
    select 1 from public.ordenes o join public.perfiles pf on pf.id = auth.uid()
    where o.id = v_pieza.orden_id and (public.es_gerencia() or pf.zona_id = o.zona_id)
  ) then
    raise exception 'Sin permiso sobre esta orden';
  end if;

  if v_pieza.estado <> 'apartada' then
    raise exception 'Solo aplica a piezas apartadas';
  end if;

  select sucursal_id into v_suc from public.ordenes where id = v_pieza.orden_id;

  if p_modo = 'stock' then
    v_tipo := 'liberar'; v_motivo := 'No usada — regresa a stock (vobo gestor)'; v_nuevo_estado := 'cancelada';
  elsif p_modo = 'devolver' then
    v_tipo := 'liberar'; v_motivo := 'Des-apartada'; v_nuevo_estado := 'recomendada';
  elsif p_modo = 'retiro' then
    v_tipo := 'usar'; v_motivo := 'Retiro de stock (vobo gestor)'; v_nuevo_estado := 'cancelada';
  elsif p_modo = 'retorno' then
    v_tipo := 'usar'; v_motivo := 'Retorno a Lexmark (vobo gestor)'; v_nuevo_estado := 'cancelada';
  else
    raise exception 'Modo inválido';
  end if;

  if v_suc is not null then
    insert into public.movimientos_inventario (sucursal_id, numero_parte, tipo, cantidad, motivo, orden_id)
      values (v_suc, v_pieza.numero_parte, v_tipo, v_pieza.cantidad, v_motivo, v_pieza.orden_id);
  end if;

  update public.piezas_orden set estado = v_nuevo_estado where id = p_pieza returning * into v_pieza;
  return v_pieza;
end $$;


ALTER FUNCTION "public"."resolver_pieza_no_usada"("p_pieza" "uuid", "p_modo" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "text",
    "indicaciones" "text",
    "contacto_nombre" "text",
    "contacto_correo" "text",
    "contacto_telefono" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "creada_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gestor_id" "uuid"
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contactos_cuenta" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cuenta_id" "uuid" NOT NULL,
    "nombre" "text",
    "rol_contacto" "text",
    "correo" "text",
    "telefono" "text",
    "notas" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contactos_cuenta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contratos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "equipo_id" "uuid",
    "marca_id" "uuid" NOT NULL,
    "tipo_contrato" "text" NOT NULL,
    "fecha_inicio" "date" DEFAULT CURRENT_DATE NOT NULL,
    "fecha_fin" "date",
    "visitas_incluidas" integer,
    "notas" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subtipo_tym" "text",
    "solicitado_por_gestor_id" "uuid",
    CONSTRAINT "contratos_subtipo_tym_check" CHECK ((("subtipo_tym" IS NULL) OR ("subtipo_tym" = ANY (ARRAY['mo'::"text", 'ip'::"text", 'instalacion'::"text"])))),
    CONSTRAINT "contratos_tipo_contrato_check" CHECK (("tipo_contrato" = ANY (ARRAY['garantia'::"text", 'poliza'::"text", 'tym'::"text", 'renta'::"text", 'instalacion'::"text", 'garantia_consumible'::"text"])))
);


ALTER TABLE "public"."contratos" OWNER TO "postgres";


COMMENT ON TABLE "public"."contratos" IS 'Cobertura de servicio de un cliente (y opcionalmente un equipo específico): garantía, póliza o tiempo-y-materiales. tipo_contrato es texto+CHECK, no enum nativo, para poder ampliarlo sin ALTER TYPE.';



COMMENT ON COLUMN "public"."contratos"."equipo_id" IS 'NULL = cubre todos los equipos del cliente bajo esta marca; con valor = cubre solo ese equipo.';



COMMENT ON COLUMN "public"."contratos"."fecha_fin" IS 'NULL = vigencia indefinida.';



COMMENT ON COLUMN "public"."contratos"."visitas_incluidas" IS 'NULL = visitas ilimitadas dentro de la vigencia.';



CREATE TABLE IF NOT EXISTS "public"."encargados_almacen" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "perfil_id" "uuid" NOT NULL,
    "sucursal_id" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."encargados_almacen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "marca_id" "uuid" NOT NULL,
    "modelo" "text",
    "serie" "text",
    "notas" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."equipos" OWNER TO "postgres";


COMMENT ON TABLE "public"."equipos" IS 'Máquina física (impresora) de un cliente. Base para historial por equipo y cobertura de contratos.';



CREATE TABLE IF NOT EXISTS "public"."evidencias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "url" "text" NOT NULL,
    "nota" "text",
    "subida_por" "uuid" DEFAULT "auth"."uid"(),
    "creada_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evidencias_tipo_check" CHECK (("tipo" = ANY (ARRAY['llegada'::"text", 'antes'::"text", 'durante'::"text", 'despues'::"text", 'piezas'::"text", 'os_firmada'::"text", 'reporte_equipo'::"text"])))
);


ALTER TABLE "public"."evidencias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gestores_cuenta" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "correo" "text",
    "telefono" "text",
    "empresa" "text",
    "marca_id" "uuid",
    "rol_contacto" "text",
    "notas" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gestores_cuenta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingenieros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "zona_id" "uuid",
    "sucursal" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "viaje_min" integer DEFAULT 30,
    "hora_comida" time without time zone,
    "nombre_corto" "text",
    "correo" "text",
    "telefono" "text",
    "empresa" "text",
    "sucursal_id" "uuid"
);


ALTER TABLE "public"."ingenieros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_parte" "text" NOT NULL,
    "sucursal_id" "uuid" NOT NULL,
    "cantidad_disponible" integer DEFAULT 0 NOT NULL,
    "cantidad_apartada" integer DEFAULT 0 NOT NULL,
    "stock_minimo" integer DEFAULT 0 NOT NULL,
    "ubicacion" "text",
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marcas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL
);


ALTER TABLE "public"."marcas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movimientos_inventario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sucursal_id" "uuid" NOT NULL,
    "numero_parte" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "cantidad" integer NOT NULL,
    "motivo" "text",
    "orden_id" "uuid",
    "usuario_id" "uuid" DEFAULT "auth"."uid"(),
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "movimientos_inventario_cantidad_check" CHECK (("cantidad" >= 0)),
    CONSTRAINT "movimientos_inventario_tipo_check" CHECK (("tipo" = ANY (ARRAY['entrada'::"text", 'salida'::"text", 'ajuste'::"text", 'apartar'::"text", 'liberar'::"text", 'usar'::"text"])))
);


ALTER TABLE "public"."movimientos_inventario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ordenes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "zona_id" "uuid" NOT NULL,
    "marca_id" "uuid" NOT NULL,
    "origen" "text" DEFAULT 'MANUAL'::"text" NOT NULL,
    "numero_orden" "text" NOT NULL,
    "numero_visita" integer DEFAULT 1 NOT NULL,
    "cliente" "text" NOT NULL,
    "contacto" "text",
    "tel_fijo" "text",
    "tel_movil" "text",
    "direccion" "text",
    "localidad" "text",
    "estado" "text",
    "modelo" "text",
    "serie" "text",
    "falla" "text",
    "partes_recomendadas" "text",
    "comentarios" "text",
    "fecha_eta" "date",
    "hora_eta" "text",
    "ingeniero_id" "uuid",
    "sucursal" "text",
    "estatus" "public"."estatus_orden" DEFAULT 'Nuevo'::"public"."estatus_orden" NOT NULL,
    "link_doc" "text",
    "link_pdf" "text",
    "datos_especificos" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hora_inicio_real" time without time zone,
    "hora_fin_real" time without time zone,
    "lat_inicio" double precision,
    "lng_inicio" double precision,
    "contador_mono" integer,
    "contador_color" integer,
    "diagnostico_campo" "text",
    "checklist" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sucursal_id" "uuid",
    "cliente_id" "uuid",
    "equipo_id" "uuid",
    "contrato_id" "uuid"
);


ALTER TABLE "public"."ordenes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ordenes"."cliente_id" IS 'FK a clientes (nullable, aditivo). ordenes.cliente (texto) se conserva.';



COMMENT ON COLUMN "public"."ordenes"."equipo_id" IS 'FK a equipos (nullable, aditivo). ordenes.modelo/serie (texto) se conservan.';



COMMENT ON COLUMN "public"."ordenes"."contrato_id" IS 'Contrato bajo el que se atiende esta visita, si aplica (garantía/póliza/TyM). NULL = fuera de contrato.';



CREATE TABLE IF NOT EXISTS "public"."ordenes_historial" (
    "id" bigint NOT NULL,
    "orden_id" "uuid",
    "estatus_anterior" "public"."estatus_orden",
    "estatus_nuevo" "public"."estatus_orden",
    "usuario_id" "uuid",
    "cambiado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ordenes_historial" OWNER TO "postgres";


ALTER TABLE "public"."ordenes_historial" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ordenes_historial_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."perfiles" (
    "id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "rol" "public"."rol_usuario" DEFAULT 'coordinador'::"public"."rol_usuario" NOT NULL,
    "zona_id" "uuid",
    "debe_cambiar_password" boolean DEFAULT false NOT NULL,
    "ingeniero_id" "uuid"
);


ALTER TABLE "public"."perfiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."perfiles"."ingeniero_id" IS 'Si el usuario es rol ingeniero, apunta a su fila en public.ingenieros (la que referencian las órdenes).';



CREATE TABLE IF NOT EXISTS "public"."piezas_catalogo" (
    "numero_parte" "text" NOT NULL,
    "descripcion" "text",
    "creada_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "Tipo" "public"."Tipos de piezas"
);


ALTER TABLE "public"."piezas_catalogo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preferencias_usuario" (
    "user_id" "uuid" NOT NULL,
    "clave" "text" NOT NULL,
    "valor" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preferencias_usuario" OWNER TO "postgres";


COMMENT ON TABLE "public"."preferencias_usuario" IS 'Preferencias de interfaz por usuario. clave: inicio_vista | panel_layout.';



CREATE TABLE IF NOT EXISTS "public"."sucursales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "ciudad" "text",
    "estado" "text",
    "lat" double precision,
    "lng" double precision,
    "empresa" "text" DEFAULT 'alpha'::"text" NOT NULL,
    "zona_id" "uuid",
    "activa" boolean DEFAULT true NOT NULL,
    "creada_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sucursales_empresa_check" CHECK (("empresa" = ANY (ARRAY['alpha'::"text", 'baja'::"text"])))
);


ALTER TABLE "public"."sucursales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zonas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "coordinador_nombre" "text",
    "drive_folder_id" "text"
);


ALTER TABLE "public"."zonas" OWNER TO "postgres";


ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contactos_cuenta"
    ADD CONSTRAINT "contactos_cuenta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gestores_cuenta"
    ADD CONSTRAINT "contactos_mesa_servicio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contratos"
    ADD CONSTRAINT "contratos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."encargados_almacen"
    ADD CONSTRAINT "encargados_almacen_perfil_id_sucursal_id_key" UNIQUE ("perfil_id", "sucursal_id");



ALTER TABLE ONLY "public"."encargados_almacen"
    ADD CONSTRAINT "encargados_almacen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipos"
    ADD CONSTRAINT "equipos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evidencias"
    ADD CONSTRAINT "evidencias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingenieros"
    ADD CONSTRAINT "ingenieros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventario"
    ADD CONSTRAINT "inventario_numero_parte_sucursal_id_key" UNIQUE ("numero_parte", "sucursal_id");



ALTER TABLE ONLY "public"."inventario"
    ADD CONSTRAINT "inventario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marcas"
    ADD CONSTRAINT "marcas_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."marcas"
    ADD CONSTRAINT "marcas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_historial"
    ADD CONSTRAINT "ordenes_historial_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes"
    ADD CONSTRAINT "ordenes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes"
    ADD CONSTRAINT "ordenes_zona_id_numero_orden_numero_visita_key" UNIQUE ("zona_id", "numero_orden", "numero_visita");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piezas_catalogo"
    ADD CONSTRAINT "piezas_catalogo_pkey" PRIMARY KEY ("numero_parte");



ALTER TABLE ONLY "public"."piezas_orden"
    ADD CONSTRAINT "piezas_orden_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preferencias_usuario"
    ADD CONSTRAINT "preferencias_usuario_pkey" PRIMARY KEY ("user_id", "clave");



ALTER TABLE ONLY "public"."sucursales"
    ADD CONSTRAINT "sucursales_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."sucursales"
    ADD CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zonas"
    ADD CONSTRAINT "zonas_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."zonas"
    ADD CONSTRAINT "zonas_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "equipos_marca_serie_key" ON "public"."equipos" USING "btree" ("marca_id", "serie") WHERE ("serie" IS NOT NULL);



CREATE INDEX "ix_contactos_cuenta_cuenta" ON "public"."contactos_cuenta" USING "btree" ("cuenta_id");



CREATE INDEX "ix_contratos_cliente" ON "public"."contratos" USING "btree" ("cliente_id");



CREATE INDEX "ix_contratos_equipo" ON "public"."contratos" USING "btree" ("equipo_id");



CREATE INDEX "ix_contratos_marca" ON "public"."contratos" USING "btree" ("marca_id");



CREATE INDEX "ix_contratos_solicitado_por" ON "public"."contratos" USING "btree" ("solicitado_por_gestor_id") WHERE ("solicitado_por_gestor_id" IS NOT NULL);



CREATE INDEX "ix_contratos_vigencia" ON "public"."contratos" USING "btree" ("fecha_inicio", "fecha_fin");



CREATE INDEX "ix_cuentas_lexmark_gestor" ON "public"."clientes" USING "btree" ("gestor_id");



CREATE INDEX "ix_encargados_almacen_sucursal" ON "public"."encargados_almacen" USING "btree" ("sucursal_id");



CREATE INDEX "ix_equipos_cliente" ON "public"."equipos" USING "btree" ("cliente_id");



CREATE INDEX "ix_equipos_marca" ON "public"."equipos" USING "btree" ("marca_id");



CREATE INDEX "ix_evidencias_orden" ON "public"."evidencias" USING "btree" ("orden_id");



CREATE INDEX "ix_evidencias_subida_por" ON "public"."evidencias" USING "btree" ("subida_por");



CREATE INDEX "ix_gestores_cuenta_marca" ON "public"."gestores_cuenta" USING "btree" ("marca_id");



CREATE INDEX "ix_ingenieros_zona" ON "public"."ingenieros" USING "btree" ("zona_id");



CREATE INDEX "ix_inventario_sucursal" ON "public"."inventario" USING "btree" ("sucursal_id");



CREATE INDEX "ix_mov_inv_numero_parte" ON "public"."movimientos_inventario" USING "btree" ("numero_parte");



CREATE INDEX "ix_mov_inv_orden" ON "public"."movimientos_inventario" USING "btree" ("orden_id");



CREATE INDEX "ix_mov_inv_sucursal" ON "public"."movimientos_inventario" USING "btree" ("sucursal_id");



CREATE INDEX "ix_mov_inv_usuario" ON "public"."movimientos_inventario" USING "btree" ("usuario_id");



CREATE INDEX "ix_ordenes_cliente" ON "public"."ordenes" USING "btree" ("cliente_id");



CREATE INDEX "ix_ordenes_contrato" ON "public"."ordenes" USING "btree" ("contrato_id");



CREATE INDEX "ix_ordenes_equipo" ON "public"."ordenes" USING "btree" ("equipo_id");



CREATE INDEX "ix_ordenes_fecha_eta" ON "public"."ordenes" USING "btree" ("fecha_eta") WHERE ("fecha_eta" IS NOT NULL);



CREATE INDEX "ix_ordenes_historial_orden" ON "public"."ordenes_historial" USING "btree" ("orden_id");



CREATE INDEX "ix_ordenes_historial_usuario" ON "public"."ordenes_historial" USING "btree" ("usuario_id");



CREATE INDEX "ix_ordenes_ingeniero" ON "public"."ordenes" USING "btree" ("ingeniero_id");



CREATE INDEX "ix_ordenes_marca" ON "public"."ordenes" USING "btree" ("marca_id");



CREATE INDEX "ix_ordenes_sucursal_id" ON "public"."ordenes" USING "btree" ("sucursal_id");



CREATE INDEX "ix_ordenes_zona_estatus" ON "public"."ordenes" USING "btree" ("zona_id", "estatus");



CREATE INDEX "ix_perfiles_ingeniero" ON "public"."perfiles" USING "btree" ("ingeniero_id");



CREATE INDEX "ix_perfiles_zona" ON "public"."perfiles" USING "btree" ("zona_id");



CREATE INDEX "ix_piezas_orden_recibida_por" ON "public"."piezas_orden" USING "btree" ("recibida_por");



CREATE INDEX "ix_sucursales_zona" ON "public"."sucursales" USING "btree" ("zona_id");



CREATE INDEX "piezas_orden_estado_idx" ON "public"."piezas_orden" USING "btree" ("estado");



CREATE INDEX "piezas_orden_orden_id_idx" ON "public"."piezas_orden" USING "btree" ("orden_id");



CREATE OR REPLACE TRIGGER "trg_aplicar_movimiento" AFTER INSERT ON "public"."movimientos_inventario" FOR EACH ROW EXECUTE FUNCTION "public"."fn_aplicar_movimiento"();



CREATE OR REPLACE TRIGGER "trg_cascada_concluido" AFTER UPDATE ON "public"."ordenes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_cascada_concluido"();



CREATE OR REPLACE TRIGGER "trg_historial" BEFORE UPDATE ON "public"."ordenes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_registrar_historial"();



CREATE OR REPLACE TRIGGER "trg_pieza_stock" BEFORE INSERT OR UPDATE ON "public"."piezas_orden" FOR EACH ROW EXECUTE FUNCTION "public"."fn_pieza_stock"();



CREATE OR REPLACE TRIGGER "trg_piezas_arribo" AFTER INSERT OR UPDATE ON "public"."piezas_orden" FOR EACH ROW EXECUTE FUNCTION "public"."fn_piezas_arribo"();



CREATE OR REPLACE TRIGGER "trg_resolver_sucursal" BEFORE INSERT OR UPDATE OF "sucursal" ON "public"."ordenes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_resolver_sucursal_orden"();



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "public"."gestores_cuenta"("id");



ALTER TABLE ONLY "public"."contactos_cuenta"
    ADD CONSTRAINT "contactos_cuenta_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gestores_cuenta"
    ADD CONSTRAINT "contactos_mesa_servicio_marca_id_fkey" FOREIGN KEY ("marca_id") REFERENCES "public"."marcas"("id");



ALTER TABLE ONLY "public"."contratos"
    ADD CONSTRAINT "contratos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contratos"
    ADD CONSTRAINT "contratos_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "public"."equipos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contratos"
    ADD CONSTRAINT "contratos_marca_id_fkey" FOREIGN KEY ("marca_id") REFERENCES "public"."marcas"("id");



ALTER TABLE ONLY "public"."contratos"
    ADD CONSTRAINT "contratos_solicitado_por_gestor_id_fkey" FOREIGN KEY ("solicitado_por_gestor_id") REFERENCES "public"."gestores_cuenta"("id");



ALTER TABLE ONLY "public"."encargados_almacen"
    ADD CONSTRAINT "encargados_almacen_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipos"
    ADD CONSTRAINT "equipos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."equipos"
    ADD CONSTRAINT "equipos_marca_id_fkey" FOREIGN KEY ("marca_id") REFERENCES "public"."marcas"("id");



ALTER TABLE ONLY "public"."evidencias"
    ADD CONSTRAINT "evidencias_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evidencias"
    ADD CONSTRAINT "evidencias_subida_por_fkey" FOREIGN KEY ("subida_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ingenieros"
    ADD CONSTRAINT "ingenieros_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."ingenieros"
    ADD CONSTRAINT "ingenieros_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "public"."zonas"("id");



ALTER TABLE ONLY "public"."inventario"
    ADD CONSTRAINT "inventario_numero_parte_fkey" FOREIGN KEY ("numero_parte") REFERENCES "public"."piezas_catalogo"("numero_parte");



ALTER TABLE ONLY "public"."inventario"
    ADD CONSTRAINT "inventario_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_numero_parte_fkey" FOREIGN KEY ("numero_parte") REFERENCES "public"."piezas_catalogo"("numero_parte");



ALTER TABLE ONLY "public"."movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes"("id");



ALTER TABLE ONLY "public"."movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ordenes"
    ADD CONSTRAINT "ordenes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes"
    ADD CONSTRAINT "ordenes_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes"
    ADD CONSTRAINT "ordenes_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "public"."equipos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes_historial"
    ADD CONSTRAINT "ordenes_historial_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_historial"
    ADD CONSTRAINT "ordenes_historial_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ordenes"
    ADD CONSTRAINT "ordenes_ingeniero_id_fkey" FOREIGN KEY ("ingeniero_id") REFERENCES "public"."ingenieros"("id");



ALTER TABLE ONLY "public"."ordenes"
    ADD CONSTRAINT "ordenes_marca_id_fkey" FOREIGN KEY ("marca_id") REFERENCES "public"."marcas"("id");



ALTER TABLE ONLY "public"."ordenes"
    ADD CONSTRAINT "ordenes_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."ordenes"
    ADD CONSTRAINT "ordenes_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "public"."zonas"("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_ingeniero_id_fkey" FOREIGN KEY ("ingeniero_id") REFERENCES "public"."ingenieros"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "public"."zonas"("id");



ALTER TABLE ONLY "public"."piezas_orden"
    ADD CONSTRAINT "piezas_orden_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piezas_orden"
    ADD CONSTRAINT "piezas_orden_recibida_por_fkey" FOREIGN KEY ("recibida_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."preferencias_usuario"
    ADD CONSTRAINT "preferencias_usuario_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sucursales"
    ADD CONSTRAINT "sucursales_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "public"."zonas"("id");



ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_del" ON "public"."clientes" FOR DELETE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "clientes_ins" ON "public"."clientes" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "clientes_sel" ON "public"."clientes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "clientes_upd" ON "public"."clientes" FOR UPDATE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia")) WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



ALTER TABLE "public"."contactos_cuenta" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contactos_cuenta_del" ON "public"."contactos_cuenta" FOR DELETE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "contactos_cuenta_ins" ON "public"."contactos_cuenta" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "contactos_cuenta_sel" ON "public"."contactos_cuenta" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "contactos_cuenta_upd" ON "public"."contactos_cuenta" FOR UPDATE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia")) WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



ALTER TABLE "public"."contratos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contratos_del" ON "public"."contratos" FOR DELETE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "contratos_ins" ON "public"."contratos" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "contratos_sel" ON "public"."contratos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "contratos_upd" ON "public"."contratos" FOR UPDATE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia")) WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



ALTER TABLE "public"."encargados_almacen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "encargados_almacen_del" ON "public"."encargados_almacen" FOR DELETE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "encargados_almacen_ins" ON "public"."encargados_almacen" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "encargados_almacen_sel" ON "public"."encargados_almacen" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "encargados_almacen_upd" ON "public"."encargados_almacen" FOR UPDATE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia")) WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



ALTER TABLE "public"."equipos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "equipos_del" ON "public"."equipos" FOR DELETE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "equipos_ins" ON "public"."equipos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "equipos_sel" ON "public"."equipos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "equipos_upd" ON "public"."equipos" FOR UPDATE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia")) WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



ALTER TABLE "public"."evidencias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evidencias_ins" ON "public"."evidencias" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."ordenes" "o"
     JOIN "public"."perfiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "evidencias"."orden_id") AND (( SELECT "public"."es_gerencia"() AS "es_gerencia") OR ("p"."zona_id" = "o"."zona_id"))))));



CREATE POLICY "evidencias_sel" ON "public"."evidencias" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."ordenes" "o"
     JOIN "public"."perfiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "evidencias"."orden_id") AND (( SELECT "public"."es_gerencia"() AS "es_gerencia") OR ("p"."zona_id" = "o"."zona_id"))))));



CREATE POLICY "gerencia_edita_perfiles" ON "public"."perfiles" FOR UPDATE TO "authenticated" USING ("public"."es_gerencia"()) WITH CHECK ("public"."es_gerencia"());



ALTER TABLE "public"."gestores_cuenta" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gestores_cuenta_del" ON "public"."gestores_cuenta" FOR DELETE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "gestores_cuenta_ins" ON "public"."gestores_cuenta" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "gestores_cuenta_sel" ON "public"."gestores_cuenta" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "gestores_cuenta_upd" ON "public"."gestores_cuenta" FOR UPDATE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia")) WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



ALTER TABLE "public"."ingenieros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ingenieros_del" ON "public"."ingenieros" FOR DELETE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "ingenieros_ins" ON "public"."ingenieros" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "ingenieros_sel" ON "public"."ingenieros" FOR SELECT TO "authenticated" USING ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR (EXISTS ( SELECT 1
   FROM "public"."perfiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."zona_id" = "ingenieros"."zona_id"))))));



CREATE POLICY "ingenieros_upd" ON "public"."ingenieros" FOR UPDATE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia")) WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



ALTER TABLE "public"."inventario" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventario_del" ON "public"."inventario" FOR DELETE TO "authenticated" USING ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR ( SELECT "public"."es_encargado_de"("inventario"."sucursal_id") AS "es_encargado_de")));



CREATE POLICY "inventario_ins" ON "public"."inventario" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR ( SELECT "public"."es_encargado_de"("inventario"."sucursal_id") AS "es_encargado_de")));



CREATE POLICY "inventario_sel" ON "public"."inventario" FOR SELECT TO "authenticated" USING ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR ( SELECT "public"."es_encargado_de"("inventario"."sucursal_id") AS "es_encargado_de") OR (EXISTS ( SELECT 1
   FROM ("public"."sucursales" "s"
     JOIN "public"."perfiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("s"."id" = "inventario"."sucursal_id") AND ("s"."zona_id" = "p"."zona_id"))))));



CREATE POLICY "inventario_upd" ON "public"."inventario" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR ( SELECT "public"."es_encargado_de"("inventario"."sucursal_id") AS "es_encargado_de"))) WITH CHECK ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR ( SELECT "public"."es_encargado_de"("inventario"."sucursal_id") AS "es_encargado_de")));



ALTER TABLE "public"."marcas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marcas_del" ON "public"."marcas" FOR DELETE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "marcas_ins" ON "public"."marcas" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "marcas_sel" ON "public"."marcas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "marcas_upd" ON "public"."marcas" FOR UPDATE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia")) WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "movimientos_ins" ON "public"."movimientos_inventario" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR ( SELECT "public"."es_encargado_de"("movimientos_inventario"."sucursal_id") AS "es_encargado_de")));



ALTER TABLE "public"."movimientos_inventario" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "movimientos_sel" ON "public"."movimientos_inventario" FOR SELECT TO "authenticated" USING ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR ( SELECT "public"."es_encargado_de"("movimientos_inventario"."sucursal_id") AS "es_encargado_de") OR (EXISTS ( SELECT 1
   FROM ("public"."sucursales" "s"
     JOIN "public"."perfiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("s"."id" = "movimientos_inventario"."sucursal_id") AND ("s"."zona_id" = "p"."zona_id"))))));



ALTER TABLE "public"."ordenes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_historial" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ordenes_historial_sel" ON "public"."ordenes_historial" FOR SELECT TO "authenticated" USING ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR (EXISTS ( SELECT 1
   FROM ("public"."ordenes" "o"
     JOIN "public"."perfiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "ordenes_historial"."orden_id") AND ("p"."zona_id" = "o"."zona_id"))))));



CREATE POLICY "ordenes_ins" ON "public"."ordenes" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR (EXISTS ( SELECT 1
   FROM "public"."perfiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."zona_id" = "ordenes"."zona_id"))))));



CREATE POLICY "ordenes_sel" ON "public"."ordenes" FOR SELECT TO "authenticated" USING ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR (EXISTS ( SELECT 1
   FROM "public"."perfiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."zona_id" = "ordenes"."zona_id"))))));



CREATE POLICY "ordenes_upd" ON "public"."ordenes" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR (EXISTS ( SELECT 1
   FROM "public"."perfiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."zona_id" = "ordenes"."zona_id")))))) WITH CHECK ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR (EXISTS ( SELECT 1
   FROM "public"."perfiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."zona_id" = "ordenes"."zona_id"))))));



ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perfiles_sel" ON "public"."perfiles" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "id") OR ( SELECT "public"."es_gerencia"() AS "es_gerencia")));



ALTER TABLE "public"."piezas_catalogo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "piezas_catalogo_del" ON "public"."piezas_catalogo" FOR DELETE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "piezas_catalogo_ins" ON "public"."piezas_catalogo" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "piezas_catalogo_sel" ON "public"."piezas_catalogo" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "piezas_catalogo_upd" ON "public"."piezas_catalogo" FOR UPDATE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia")) WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



ALTER TABLE "public"."piezas_orden" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "piezas_orden_del" ON "public"."piezas_orden" FOR DELETE TO "authenticated" USING ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR (EXISTS ( SELECT 1
   FROM ("public"."ordenes" "o"
     JOIN "public"."perfiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "piezas_orden"."orden_id") AND ("p"."zona_id" = "o"."zona_id"))))));



CREATE POLICY "piezas_orden_ins" ON "public"."piezas_orden" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR (EXISTS ( SELECT 1
   FROM ("public"."ordenes" "o"
     JOIN "public"."perfiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "piezas_orden"."orden_id") AND ("p"."zona_id" = "o"."zona_id"))))));



CREATE POLICY "piezas_orden_sel" ON "public"."piezas_orden" FOR SELECT TO "authenticated" USING ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR (EXISTS ( SELECT 1
   FROM ("public"."ordenes" "o"
     JOIN "public"."perfiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "piezas_orden"."orden_id") AND ("p"."zona_id" = "o"."zona_id"))))));



CREATE POLICY "piezas_orden_upd" ON "public"."piezas_orden" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR (EXISTS ( SELECT 1
   FROM ("public"."ordenes" "o"
     JOIN "public"."perfiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "piezas_orden"."orden_id") AND ("p"."zona_id" = "o"."zona_id")))))) WITH CHECK ((( SELECT "public"."es_gerencia"() AS "es_gerencia") OR (EXISTS ( SELECT 1
   FROM ("public"."ordenes" "o"
     JOIN "public"."perfiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "piezas_orden"."orden_id") AND ("p"."zona_id" = "o"."zona_id"))))));



ALTER TABLE "public"."preferencias_usuario" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prefs_insert_propias" ON "public"."preferencias_usuario" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "prefs_select_propias" ON "public"."preferencias_usuario" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "prefs_update_propias" ON "public"."preferencias_usuario" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."sucursales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sucursales_del" ON "public"."sucursales" FOR DELETE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "sucursales_ins" ON "public"."sucursales" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "sucursales_sel" ON "public"."sucursales" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "sucursales_upd" ON "public"."sucursales" FOR UPDATE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia")) WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



ALTER TABLE "public"."zonas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zonas_del" ON "public"."zonas" FOR DELETE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "zonas_ins" ON "public"."zonas" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));



CREATE POLICY "zonas_sel" ON "public"."zonas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "zonas_upd" ON "public"."zonas" FOR UPDATE TO "authenticated" USING (( SELECT "public"."es_gerencia"() AS "es_gerencia")) WITH CHECK (( SELECT "public"."es_gerencia"() AS "es_gerencia"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."es_encargado_de"("suc" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_encargado_de"("suc" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."es_gerencia"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_aplicar_movimiento"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_aplicar_movimiento"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_cascada_concluido"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_cascada_concluido"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_pieza_stock"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_pieza_stock"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_piezas_arribo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_piezas_arribo"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_registrar_historial"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_registrar_historial"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_resolver_sucursal_orden"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_resolver_sucursal_orden"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."password_cambiada"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."password_cambiada"() TO "service_role";



GRANT ALL ON TABLE "public"."piezas_orden" TO "anon";
GRANT ALL ON TABLE "public"."piezas_orden" TO "authenticated";
GRANT ALL ON TABLE "public"."piezas_orden" TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolver_pieza_no_usada"("p_pieza" "uuid", "p_modo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolver_pieza_no_usada"("p_pieza" "uuid", "p_modo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolver_pieza_no_usada"("p_pieza" "uuid", "p_modo" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON TABLE "public"."contactos_cuenta" TO "anon";
GRANT ALL ON TABLE "public"."contactos_cuenta" TO "authenticated";
GRANT ALL ON TABLE "public"."contactos_cuenta" TO "service_role";



GRANT ALL ON TABLE "public"."contratos" TO "anon";
GRANT ALL ON TABLE "public"."contratos" TO "authenticated";
GRANT ALL ON TABLE "public"."contratos" TO "service_role";



GRANT ALL ON TABLE "public"."encargados_almacen" TO "anon";
GRANT ALL ON TABLE "public"."encargados_almacen" TO "authenticated";
GRANT ALL ON TABLE "public"."encargados_almacen" TO "service_role";



GRANT ALL ON TABLE "public"."equipos" TO "anon";
GRANT ALL ON TABLE "public"."equipos" TO "authenticated";
GRANT ALL ON TABLE "public"."equipos" TO "service_role";



GRANT ALL ON TABLE "public"."evidencias" TO "anon";
GRANT ALL ON TABLE "public"."evidencias" TO "authenticated";
GRANT ALL ON TABLE "public"."evidencias" TO "service_role";



GRANT ALL ON TABLE "public"."gestores_cuenta" TO "anon";
GRANT ALL ON TABLE "public"."gestores_cuenta" TO "authenticated";
GRANT ALL ON TABLE "public"."gestores_cuenta" TO "service_role";



GRANT ALL ON TABLE "public"."ingenieros" TO "anon";
GRANT ALL ON TABLE "public"."ingenieros" TO "authenticated";
GRANT ALL ON TABLE "public"."ingenieros" TO "service_role";



GRANT ALL ON TABLE "public"."inventario" TO "anon";
GRANT ALL ON TABLE "public"."inventario" TO "authenticated";
GRANT ALL ON TABLE "public"."inventario" TO "service_role";



GRANT ALL ON TABLE "public"."marcas" TO "anon";
GRANT ALL ON TABLE "public"."marcas" TO "authenticated";
GRANT ALL ON TABLE "public"."marcas" TO "service_role";



GRANT ALL ON TABLE "public"."movimientos_inventario" TO "anon";
GRANT ALL ON TABLE "public"."movimientos_inventario" TO "authenticated";
GRANT ALL ON TABLE "public"."movimientos_inventario" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes" TO "anon";
GRANT ALL ON TABLE "public"."ordenes" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_historial" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_historial" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_historial" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ordenes_historial_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ordenes_historial_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ordenes_historial_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."perfiles" TO "anon";
GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";



GRANT ALL ON TABLE "public"."piezas_catalogo" TO "anon";
GRANT ALL ON TABLE "public"."piezas_catalogo" TO "authenticated";
GRANT ALL ON TABLE "public"."piezas_catalogo" TO "service_role";



GRANT ALL ON TABLE "public"."preferencias_usuario" TO "anon";
GRANT ALL ON TABLE "public"."preferencias_usuario" TO "authenticated";
GRANT ALL ON TABLE "public"."preferencias_usuario" TO "service_role";



GRANT ALL ON TABLE "public"."sucursales" TO "anon";
GRANT ALL ON TABLE "public"."sucursales" TO "authenticated";
GRANT ALL ON TABLE "public"."sucursales" TO "service_role";



GRANT ALL ON TABLE "public"."zonas" TO "anon";
GRANT ALL ON TABLE "public"."zonas" TO "authenticated";
GRANT ALL ON TABLE "public"."zonas" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































