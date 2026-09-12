-- Hoy `clientes.indicaciones` es un solo campo de texto libre que mezcla lo
-- que le toca al coordinador (avisar con anticipación, mandar el INE por
-- correo) con lo que le toca al ingeniero en sitio (EPP, credencial,
-- presentarse con identificación). El usuario pidió separarlo en dos
-- columnas — esta migración solo abre el espacio; `indicaciones` se
-- conserva tal cual (nadie pierde nada) hasta que se revise cuenta por
-- cuenta cuál texto va a cada lado (ver
-- "Directorio de Cuentas - Coordinador vs Ingeniero (borrador).xlsx",
-- generado 2026-09-12 a partir de "Directorio de Cuentas MPS 2026").

alter table public.clientes
  add column if not exists indicaciones_coordinador text,
  add column if not exists indicaciones_ingeniero text;

comment on column public.clientes.indicaciones_coordinador is
  'Lo que resuelve el coordinador antes de la visita: avisos, correos de acceso, anticipación, documentos a enviar.';
comment on column public.clientes.indicaciones_ingeniero is
  'Lo que el ingeniero hace/lleva en sitio: EPP, identificación, credencial, cursos previos.';
comment on column public.clientes.indicaciones is
  'Texto libre original (legado) — se está dividiendo en indicaciones_coordinador/indicaciones_ingeniero cuenta por cuenta, no borrar hasta terminar esa revisión.';
