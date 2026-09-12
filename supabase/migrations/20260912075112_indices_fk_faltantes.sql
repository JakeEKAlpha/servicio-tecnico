-- Foreign keys sin índice de cobertura, detectadas por el performance
-- advisor de Supabase (2026-09-12). Inofensivo hoy con el volumen de datos
-- actual, pero JOINs/filtros por estas columnas escalan mal sin índice.

create index if not exists ix_ingenieros_empresa_id
  on public.ingenieros (empresa_id);

create index if not exists ix_ingenieros_sucursal_id
  on public.ingenieros (sucursal_id);

create index if not exists ix_notificaciones_enviadas_destinatario_perfil_id
  on public.notificaciones_enviadas (destinatario_perfil_id);

create index if not exists ix_sucursales_empresa_id
  on public.sucursales (empresa_id);

create index if not exists ix_zonas_empresa_id
  on public.zonas (empresa_id);
