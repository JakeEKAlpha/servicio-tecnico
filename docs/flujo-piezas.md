# Flujo de piezas recomendadas — WO Lexmark

> Borrador para confirmar antes de programar todos los disparadores. Basado en
> lo que describió el coordinador (2026-09-10).

## Actores

| Actor | Rol en la app | Qué hace con piezas |
|---|---|---|
| **Coordinador** (de zona) | `coordinador` | Valida y agrega las piezas recomendadas del resumen de la WO. Marca "Ir con piezas recomendadas". Consulta stock (solo lectura). |
| **Encargado de almacén** (por sucursal) | `almacen` | Valida existencia física + en sistema. Registra entradas/salidas/ajustes. Notifica arribos. |
| **Ingeniero** (de campo) | `ingeniero` | Recoge las piezas apartadas. Confirma el **uso** real de cada pieza. |
| **Gestor de cuenta** (Lexmark) | `gestores_cuenta` (dato, no login por ahora) | Da **visto bueno** para: añadir a stock, retirar de stock, o retornar una pieza pedida-no-usada. |

## Estados de `piezas_orden.estado`

`recomendada` → `apartada` → `usada`
                       ↘ (no usada) → decisión del gestor
`en_espera` (pedida / reposición) → `recibida`
`cancelada` (en cualquier punto)

## Secuencia

1. **Alta de recomendadas.** Al registrar/abrir una WO, el resumen (`falla`) trae
   números de parte. La app los **detecta** (patrón `NNXNNNN`, ej. `40X7743`) y el
   coordinador confirma cuáles agregar → `piezas_orden` estado `recomendada`.
   *(El módulo de piezas va ARRIBA en el detalle, no al final.)*

2. **Disponibilidad automática.** Para cada pieza recomendada, la app muestra
   `inventario.cantidad_disponible` de la **sucursal de la orden** (`ordenes.sucursal_id`).

3. **Validación de almacén.** La pieza queda pendiente de que el **encargado** de
   esa sucursal confirme existencia física + sistema → `piezas_orden.validada_almacen = true`.
   *(Notificación: por ahora, un contador de "piezas por validar" en la vista del encargado.)*

4. **Apartar.** Cuando el coordinador pulsa **"Ir con piezas recomendadas"** (y las
   piezas están validadas), pasan a `apartada`:
   - `inventario.cantidad_apartada += cantidad`
   - **No** se registra salida todavía.
   - El **ingeniero** es notificado de que hay piezas apartadas para recoger en
     oficina/almacén. Ese viaje es **acumulable** con otras WO/SR (un día antes,
     horas antes…). *(La agrupación de viajes es una fase posterior.)*

5. **Uso.** El ingeniero, en campo, **confirma el uso** de cada pieza → `usada`:
   - Se crea `movimientos_inventario` tipo `salida` (ahora sí baja `cantidad_disponible`)
   - `inventario.cantidad_apartada -= cantidad`
   - Se **solicita reposición** en la WO → nueva `piezas_orden` estado `en_espera`,
     `es_reposicion = true`.

6. **Reposición.** Cuando la pieza de reposición llega, el **encargado** confirma
   arribo → `recibida` → `movimientos_inventario` tipo `entrada` (vuelve al stock).

7. **Pieza pedida pero NO usada.** Si una pieza `apartada` (o una reposición
   `en_espera`/`recibida`) no se usa, el **gestor de cuenta** da visto bueno a una de:
   - **Añadir a stock** → `entrada` + `apartada -= cantidad` (si venía apartada), pieza `cancelada`.
   - **Retirar de stock** → sin movimiento de entrada; `apartada -= cantidad`; pieza `cancelada`.
   - **Retornar** (devolver a Lexmark) → `apartada -= cantidad`; pieza `cancelada`; se marca como retorno.
   *(Requiere que el gestor tenga forma de aprobar — login con rol nuevo `gestor`, o
   una cola de aprobaciones que gerencia/almacén ejecutan "a nombre de".)*

## Respuestas del coordinador (2026-09-10) — IMPLEMENTADO

- **P1.** El gestor **no** tiene login. El coordinador captura su visto bueno
  (botones "Regresar a stock / Retirar / Retornar" en la pieza apartada).
- **P2.** "Ir con piezas recomendadas" aparta **todas las validadas** de una vez;
  el coordinador además puede "Ir sin esta" pieza (la cancela).
- **P3.** El **coordinador decide** el flujo cuando no hay stock (agrega la pieza
  como "en espera" a mano si toca pedirla).
- **P4.** Reposición **siempre 1:1** con la pieza usada (lo hace el trigger).
- **P5.** Notificaciones: **después**. Por ahora sin badges.
