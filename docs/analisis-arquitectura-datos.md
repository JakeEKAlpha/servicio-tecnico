# Análisis: esquema actual vs. propuesta ERP multiflujo

**Fecha:** 2026-09-10 · **Regla del usuario:** no eliminar campos; esto es material para _considerar_, no verdad absoluta.

## Resumen en una línea

La propuesta de ChatGPT es un **ERP completo** (servicio + ventas + rentas + garantías + inventario + facturación + motor de workflows). El esquema actual es una **rebanada vertical** enfocada en órdenes de servicio Lexmark. Recomendación: **evolucionar el actual incorporando ideas concretas**, no reemplazarlo de golpe.

## Qué tiene bien la propuesta (vale la pena adoptar, por partes)

| Idea de la propuesta | Estado actual | Valor | Prioridad |
|---|---|---|---|
| `empresas` → `sucursales` → `areas` | `sucursales.empresa` es texto (`alpha`/`baja`) | Formaliza la separación Alpha/Baja | Baja (el texto ya funciona) |
| `equipos` / `modelos` (impresora con `serie` como entidad) | `ordenes.modelo` + `ordenes.serie` texto libre + `datos_especificos` jsonb | **Historial por equipo**: ver todas las visitas de una impresora | **Alta** |
| `clientes` / `contactos` como entidades | `ordenes.cliente` texto libre | Deduplicar clientes, direcciones, contactos | Media |
| `visitas` hijas de `servicios` | Ya lo hacemos: varias filas `ordenes` con mismo `numero_orden` y `numero_visita` distinto | — | Ya resuelto |
| `inventario` + `movimientos_inventario` por almacén | Solo `piezas_orden` (piezas atadas a una orden). **No hay stock libre por sucursal** | Stock real, mínimos, ubicación, kardex | **Alta** (bloquea "pasar datos de almacén") |
| `documentos_evidencias` / `evidencias` (fotos, OS firmada) | No existe | Necesario para la app del ingeniero en campo | **Alta** |
| `workflow_estados` / `transiciones` / `reglas_sla` (motor de estados genérico) | `estatus_orden` enum + triggers en Postgres | Flexible pero pesado; hoy tenemos **un** flujo | Baja / diferir |
| `sla` (tiempo respuesta / solución) | No existe | Útil con Lexmark (compromisos de tiempo) | Media |

## Qué NO conviene copiar ahora

- **PKs `INT` autoincrement.** Seguimos con `uuid` (default de Supabase, sin contención de secuencias, seguro en entornos distribuidos). No migrar llaves.
- **Motor de workflows genérico.** Sobra para un solo flujo. Revisar si/cuando entren Ventas o Rentas de verdad.
- **Facturación / pagos.** Fuera de alcance del proyecto actual (migración de Sheets de servicio técnico).
- **Big-bang.** ~40 tablas nuevas casi todas vacías frenarían la entrega y nos harían re-tunear RLS y triggers ya probados.

## Plan incremental sugerido (aditivo, sin borrar nada)

1. **`equipos`** (`id`, `marca_id`, `modelo`, `serie` unique, `cliente` / `cliente_id`, `notas`) + `ordenes.equipo_id` uuid **nullable**. Se llena desde la importación (ya viene serie). Deja `ordenes.modelo`/`serie` como están.
2. **`inventario`** (`sucursal_id` → `sucursales`, `numero_parte` → `piezas_catalogo`, `existencia`, `stock_minimo`, `ubicacion`) + **`movimientos_inventario`** (kardex: entrada/salida/ajuste, `cantidad`, `motivo`, `orden_id?`, `usuario_id`, `fecha`). Esto es lo que habilita "pasarte los datos de almacén".
3. **Campos de campo en la visita** (para la app del ingeniero y el mapa de gerencia): en `ordenes` (o una tabla `visitas_campo`) añadir `hora_inicio`, `hora_fin`, `lat_inicio`, `lng_inicio`, `contador_mono`, `contador_color`, `diagnostico`, `checklist` jsonb. Todo **nullable**.
4. **`evidencias`** (`orden_id`, `tipo` = llegada/antes/durante/despues/piezas/os_firmada/reporte_equipo, `url`, `subido_por`, `fecha`). Las sube el ingeniero a su Drive; guardamos la URL (igual que el script de referencia).
5. **`clientes`** (opcional, más adelante): entidad real + `ordenes.cliente_id` nullable, conservando `ordenes.cliente` texto.

Cada paso es una tabla nueva + una columna FK nullable. Nada se rompe; lo viejo sigue igual.

## Mapa de conceptos (propuesta → actual)

- `tickets` / `casos` → `ordenes` (cabecera) + `numero_visita`
- `servicios` / `visitas` → filas de `ordenes` con `numero_visita`
- `estados` / `workflow_estados` → enum `estatus_orden` + `lib/ordenes/estatus.ts`
- `almacenes` → `sucursales`
- `inventario` → (falta) — ver paso 2
- `partes` (de un servicio) → `piezas_orden`
- `piezas` (catálogo) → `piezas_catalogo`
- `usuarios` → `perfiles` (+ `auth.users`)
- `ingenieros` → `ingenieros`
- `contactos` (mesa/gestión) → `gestores_cuenta`
- `documentos_evidencias` → (falta) — ver paso 4
