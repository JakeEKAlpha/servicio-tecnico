# Plan de arquitectura: contratos (garantía/póliza/TyM) + Xerox + limpieza

**Fecha:** 2026-09-11. El usuario dio luz verde total ("toma las decisiones a
partir de aquí") y delegó la ejecución completa. **Fase A y Fase B ya están
hechas** (ver estado abajo y el detalle en la memoria
`cambios-bd-fuera-de-migraciones` → "Fase 20"). Sigue la filosofía ya
establecida en `docs/analisis-arquitectura-datos.md`: **evolucionar con
tablas nuevas aditivas (FK nullable), nunca borrar ni reescribir de golpe.**

## Estado

- ✅ **Fase A** — bug de marca corregido; `ordenes.sucursal`/`sucursal_id`
  revisado y descartado como deuda real (solo 4 órdenes existen, sin
  conflicto); RLS de rendimiento (`docs/db-optimizacion-rls.sql`) y "leaked
  password protection" siguen **manual-only** (bloqueados/fuera de alcance
  de las herramientas automatizadas — ver nota abajo).
- ✅ **Fase B** — `clientes`/`equipos`/`contratos` creados y en producción,
  cero pérdida de datos, cero hallazgos nuevos de seguridad.
- ⬜ **Fase C** — interfaz (Equipos/Contratos en Gerencia, contrato en
  detalle de orden) — siguiente paso.
- ⬜ **Fase D** — auditoría final de cierre.

## Decisiones de negocio confirmadas por el usuario

1. Garantía, póliza y TyM son **3 valores de un mismo concepto** — un
   contrato de servicio. No son 3 tablas distintas.
2. Xerox y los servicios propios de Alpha Digital usan **el mismo tablero y
   el mismo `estatus_orden`** que Lexmark hoy. Nada de estatus nuevos.
3. Las órdenes de Xerox se capturan **manual** por ahora (como hoy se
   capturan las `MANUAL`), sin importador propio todavía.
4. Se confirma construir sobre `equipos` + `clientes`, tal como ya lo
   recomendaba `docs/analisis-arquitectura-datos.md` (prioridad alta,
   nunca implementada).

## Auditoría — hallazgos que motivan el plan

- `cuentas_lexmark` es la única tabla de "cliente" que existe y su nombre la
  encierra a Lexmark — hay que generalizarla.
- No existe `equipos` ni `contratos` — sin esto no se puede saber si una
  visita está cubierta por garantía/póliza, ni ver el historial de una
  impresora.
- **Bug real encontrado:** `POST /api/ordenes` (`app/api/ordenes/route.ts:209`)
  usa `MARCA_LEXMARK_ID` por defecto si no llega `marca_id`, y
  `ModalNuevaOrden.tsx` **no tiene selector de marca**. Resultado: **toda
  orden creada a mano hoy queda marcada como Lexmark**, aunque sea de Xerox.
  Bloquea todo lo demás — se corrige en la Fase A.
- `ordenes.sucursal` (texto) y `ordenes.sucursal_id` (uuid) coexisten;
  todavía no armoniza (Deuda ya en `cambios-bd-fuera-de-migraciones.md`).
- Deuda ya documentada y sin cerrar: 14 políticas RLS sin optimizar
  (`docs/db-optimizacion-rls.sql`, listo para correr), leaked password
  protection apagado, 3 tablas con políticas RLS duplicadas.

## Modelo de datos nuevo

```
clientes  (era cuentas_lexmark, renombrada — mismas columnas + datos)
  id, nombre unique, tipo, indicaciones, contacto_*, gestor_id fk gestores_cuenta,
  activo, creada_en

equipos   (NUEVO)
  id, cliente_id fk clientes (nullable), marca_id fk marcas (requerido),
  modelo, serie, notas, activo, creado_en
  unique parcial (marca_id, serie) where serie is not null

contratos (NUEVO)
  id, cliente_id fk clientes (requerido), equipo_id fk equipos (nullable —
    null = cubre todos los equipos del cliente), marca_id fk marcas,
  tipo_contrato text check in ('garantia','poliza','tym'),
  fecha_inicio date, fecha_fin date (nullable = indefinido),
  visitas_incluidas int (nullable = ilimitadas), notas, activo, creado_en

ordenes += cliente_id fk clientes (nullable)
        += equipo_id  fk equipos  (nullable)
        += contrato_id fk contratos (nullable)
        -- ordenes.cliente/modelo/serie de texto NO se tocan, quedan de
        -- respaldo hasta que todo el flujo use las FK.
```

`tipo_contrato` es **texto + CHECK**, no un enum nativo de Postgres — mismo
patrón que `piezas_orden.estado` y `sucursales.empresa`. Un enum nativo no
se puede renombrar/ampliar sin `ALTER TYPE` (que además el clasificador de
esta cuenta bloquea) y ya nos mordió una vez con `rol_usuario`.

RLS de las 3 tablas: SELECT para todo `authenticated` (un coordinador debe
poder ver si una visita está cubierta); INSERT/UPDATE/DELETE solo gerencia
en `clientes` y `contratos`; en `equipos` INSERT también abierto a
`authenticated` (para registrar una máquina nueva al vuelo, igual que hoy
se puede dar de alta un número de parte desde el flujo de piezas).

## Fases de ejecución (cada una se corre, se audita y se prueba antes de
seguir a la siguiente — así lo pediste)

**Fase A — arreglos de base, bajo riesgo, no depende de nada nuevo**
1. Selector de Marca en "Nueva orden" (corrige el bug real de arriba).
2. Cerrar deuda ya documentada: `docs/db-optimizacion-rls.sql`, políticas
   duplicadas, leaked password protection (esta última es un toggle en el
   dashboard de Supabase — te paso el link, no lo puedo activar yo).
3. Decidir y limpiar `ordenes.sucursal` vs `sucursal_id`.

**Fase B — entidades nuevas (aditivas, con índices y RLS)**
4. Renombrar `cuentas_lexmark` → `clientes`, actualizar todo el código que
   la referencia (`lib/gerencia/recursos.ts`, `lib/cuentas/directorio.ts`,
   `components/CuentaLexmark.tsx`, `app/api/gerencia/*`).
5. Crear `equipos` y `contratos` con sus índices y RLS.
6. Agregar `ordenes.cliente_id` / `equipo_id` / `contrato_id`.

**Fase C — interfaz**
7. "Nueva orden": Marca ya en Fase A; agregar selector de cliente/equipo
   (con alta rápida si no existe).
8. Gerencia: recursos nuevos "Equipos" y "Contratos" (reutiliza el patrón
   de panel lateral que ya tiene Gerencia).
9. Detalle de orden: mostrar el contrato vigente si hay uno vinculado.
10. Esto también resuelve la pantalla 7b del wireframe (fichas por entidad
    para cuentas Lexmark) que había quedado pendiente — la ficha de cliente
    mostrará sus equipos y contratos.

**Fase D — auditoría final**
11. `tsc` + `eslint` + `next build`, advisors de seguridad/rendimiento,
    prueba manual por rol, y confirmar que Lexmark/WO/SR sigue exactamente
    igual (cero regresión) — nada de lo viejo se borra ni cambia de
    significado.

## Qué NO se toca en este plan

- El flujo de piezas (`SeccionPiezas.tsx`, triggers de `piezas_orden`) —
  ya está afinado y probado, ver `docs/flujo-piezas.md`.
- Las pantallas de Campo (`/campo`) — fuera de alcance de este plan de
  datos; es una app aparte.
- El trabajo de wireframe ya en curso (`docs/wireframe-integracion.md`)
  sigue como pista independiente.
