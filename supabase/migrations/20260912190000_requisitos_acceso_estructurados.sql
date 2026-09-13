-- Reemplaza el intento de anoche (indicaciones_coordinador/ingeniero, 2
-- bloques de texto libre) por la estructura real que el usuario diseñó
-- editando "Directorio de Cuentas - Coordinador vs Ingeniero (borrador).xlsx"
-- a mano: son campos discretos, no dos blobs de texto. Los 2 campos de
-- anoche están vacíos en las 96 filas (nunca se cargó nada), así que
-- eliminarlos no pierde ningún dato real.
--
-- Estos campos alimentan directamente la propuesta de
-- docs/propuesta-integracion-correo.md: requiere_correo/destinatario_correo/
-- cc_correo/datos_correo son exactamente lo que un envío automático de
-- "correo de solicitud de acceso" necesitaría por cuenta.

alter table public.clientes
  drop column if exists indicaciones_coordinador,
  drop column if exists indicaciones_ingeniero;

alter table public.clientes
  add column if not exists confirmacion_acceso boolean,
  add column if not exists equipo_seguridad boolean,
  add column if not exists identificacion_requerida boolean,
  add column if not exists anticipacion text,
  add column if not exists requiere_correo boolean,
  add column if not exists destinatario_correo text,
  add column if not exists cc_correo text,
  add column if not exists datos_correo text,
  add column if not exists horario_restringido text;

comment on column public.clientes.confirmacion_acceso is 'Requiere confirmación de acceso antes de la visita (Sí/No, del Directorio de Cuentas).';
comment on column public.clientes.equipo_seguridad is 'El ingeniero debe llevar EPP en sitio.';
comment on column public.clientes.identificacion_requerida is 'El ingeniero debe presentar identificación oficial/credencial en sitio.';
comment on column public.clientes.anticipacion is 'Cuánta anticipación pide la cuenta para avisar la visita — texto libre ("24 hrs", "No especificado"), no todas dan un número exacto.';
comment on column public.clientes.requiere_correo is 'Hay que mandar un correo de aviso/solicitud de acceso antes de la visita.';
comment on column public.clientes.destinatario_correo is 'A quién se manda ese correo (nombre, rol o "contacto descrito en sistema").';
comment on column public.clientes.cc_correo is 'A quién copiar en ese correo — normalmente el gestor de la cuenta.';
comment on column public.clientes.datos_correo is 'Qué información debe incluir el correo (ej. "ETA y nombre del técnico").';
comment on column public.clientes.horario_restringido is 'Horario real de operación/acceso restringido de la cuenta (no confundir con anticipación).';
