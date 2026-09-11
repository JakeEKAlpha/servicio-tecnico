# Integración del wireframe (Ronda 2) — seguimiento

Fuente: `Wireframes Servicio Tecnico.dc.html` (Claude Design), importado
2026-09-10 desde `Descargas/Project wireframe screens.zip`. Se implementa
turno **t11 (Ronda 2)** — ya combina/afina las propuestas de la Ronda 1
(t1–t10) por pantalla.

Regla del usuario: **el sistema de diseño del proyecto (`app/globals.css`,
`lib/tema.ts`, `lib/ui.ts`) manda sobre los tokens del wireframe** cuando
haya conflicto. El panel configurable de `/inicio` (mover/redimensionar/
quitar/agregar, `components/panel/*`) **no se toca ni se regresa**.

## Estado por pantalla

| # | Pantalla | Ref. | Estado | Commit |
|---|---|---|---|---|
| 1 | Tablero `/tablero` | 11a | ✅ hecho | `docs`+commit |
| 2 | Detalle de orden `/tablero/[id]` | 11e+11f | 🔧 ancho ampliado; ficha de color se conserva (ver D3) | — |
| 3 | Gantt del día `/tablero-dias` | 11g+11h+11i | ⏳ pendiente | — |
| 4 | Mapa por ingeniero | 11j | ⏳ pendiente (placeholder de imagen, sin geografía real) | — |
| 5 | Almacén `/almacen` | 11k+11l | ⏳ pendiente | — |
| 6 | Flujo de pedir pieza | 11m | ⏳ pendiente (puede ya estar cubierto por `lib/piezas.ts`) | — |
| 7 | Gerencia `/gerencia/[recurso]` | 11p | ✅ hecho (riel agrupado + panel lateral) | — |
| 7b | Fichas por entidad (cuentas/sucursales) | 11q | ⏳ pendiente — requiere agregar encargados+ingenieros por sucursal | — |
| 8 | Campo — agenda `/campo` | t7b | ⏳ pendiente | — |
| 9 | Campo — servicio `/campo/[id]` | t8b/8c | ⏳ pendiente | — |
| 10 | Modal nueva orden | t9b | ⏳ pendiente | — |
| 11 | Asignar sin modal | t9e | ⏳ pendiente | — |
| 12 | Configuración `/configuracion` | t10b | ⏳ pendiente | — |
| 13 | Login `/login` | t10d | ⏳ pendiente | — |
| 14 | Inicio `/inicio` | 11n/11o | ⚠️ ya cubierto por el panel configurable — ver decisión D1 | — |

## Decisiones a definir al final (no bloquean el avance)

- **D1 — Inicio vs. wireframe 5b/11n.** El wireframe pide "cola priorizada +
  carga del día + almacén, sin max-w". Ya existe el panel configurable
  (widgets movibles). Propuesta: NO reemplazar el panel; en su lugar, dejar
  el panel a `max-w-6xl` → ancho completo (quitar el límite) y evaluar si
  falta un widget "cola priorizada" al catálogo. Confirmar al final.
- **D2 — pendiente de llenar conforme aparezcan ambigüedades.**
- **D3 — Ficha de la orden: SE CONSERVA el bloque de color por marca.**
  11e propone quitar el color y dejar solo una barra de acento de 6px sobre
  panel blanco. Nuestro sistema de diseño ya definió y confirmó (varias veces,
  con el usuario viendo capturas) la ficha de color por marca — Lexmark
  verde, SR ámbar, Xerox rojo, Alpha azul — como identidad, no como "as-is"
  a corregir. Regla del usuario: el sistema de diseño del proyecto manda
  sobre el wireframe. Se implementó solo la parte de 11e/11f que no choca:
  ancho ampliado (`max-w-6xl` → `max-w-[1400px]`). Confirmar que esto es
  correcto al final.

## Notas de implementación

- Tokens nuevos del wireframe (`_ds/.../tokens/*.css`) quedan como
  referencia en `scratchpad/wireframes/` (no se importan literal); se
  adapta lo necesario a los tokens existentes en `app/globals.css`.
- El wireframe es un wireframe (cajas, sin marca): se implementa con nuestra
  identidad visual real (azul Alpha, Montserrat, tonos ya definidos).
