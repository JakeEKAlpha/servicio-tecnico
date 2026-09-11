# Integración del wireframe (Ronda 2) — seguimiento

Fuente: `Wireframes Servicio Tecnico.dc.html` (Claude Design), importado
2026-09-10 desde `Descargas/Project wireframe screens.zip`. Se implementa
turno **t11 (Ronda 2)** — ya combina/afina las propuestas de la Ronda 1
(t1–t10) por pantalla. El sistema de componentes real del wireframe está
en `_ds/.../_ds_bundle.js` (Button, Input, Chip, StatusPill, Panel,
DetailField, BrandCard, RailItem, TicketCard, Modal, Tabs, KanbanBoard,
StatWidget, DataTable) — de ahí sale la regla exacta de densidad/mayúsculas
que se está aplicando en la Fase 2.

Regla del usuario: **el sistema de diseño del proyecto (`app/globals.css`,
`lib/tema.ts`, `lib/ui.ts`) manda sobre los tokens del wireframe** cuando
haya conflicto. El panel configurable de `/inicio` (mover/redimensionar/
quitar/agregar, `components/panel/*`) **no se toca ni se regresa**. La
ficha de la orden **se conserva de color sólido por marca** (confirmado
por el usuario — D3).

## Regla de mayúsculas (confirmada contra el bundle del wireframe)

MAYÚSCULAS solo en: etiquetas de campo (`etiqueta` en `lib/ui.ts`),
encabezados de columna de tabla, etiquetas de categoría/grupo (riel,
carril). Todo lo demás — botones, pestañas, chips, títulos de sección,
valores — va en formato normal, extra bold.

---

## Plan de acción — lo que falta

### Fase 1 — pantallas (estructura/layout del wireframe) — hecho

Tablero (panel de detalle), Detalle de orden (ancho), Gerencia (riel +
panel), Login/nueva contraseña (partido), Modales (2 pasos / panel),
Almacén (riel + resumen), Configuración (vista previa), Gantt (riel
horizontal), Inicio (ancho completo). Detalle de cada una más abajo, en
"Estado por pantalla".

### Fase 2 — densidad/tipografía real del wireframe — EN CURSO

Ya aplicado a `lib/ui.ts` (botones, campos, chips, tarjetas, modales) y a
las etiquetas de formulario de: login, nueva contraseña, nueva orden,
asignar, gerencia, almacén. **Faltan estos archivos — nunca se tocaron
para peso/tamaño/radio y se nota porque son de alto tráfico:**

**Prioridad alta (se ven en cada pantalla):**
- `components/AppShell.tsx` — sidebar, header, nav. El más visible de
  todos y el único que falta.
- `components/MenuUsuario.tsx` — menú del usuario (esquina superior).
- `components/SelectorHora.tsx` y `components/SelectorIngenieroSucursal.tsx`
  — controles dentro de casi todos los formularios de agendar/asignar.

**Prioridad media (secciones específicas):**
- `components/DetalleOrden.tsx` — etiquetas de `CampoEditable`, historial,
  cuenta Lexmark.
- `components/SeccionPiezas.tsx` — 2 etiquetas sin actualizar + botones.
- `components/GanttDia.tsx` — etiqueta de fecha y leyenda de colores.
- `components/Colapsable.tsx`, `components/CuentaLexmark.tsx`,
  `components/TemaToggle.tsx`, `components/ModalPegarWOSR.tsx` — radios y
  pesos sueltos.

### Fase 3 — funcionalidad pendiente / decisiones abiertas

| # | Qué falta | Referencia | Bloqueo |
|---|---|---|---|
| D1 | Widget "cola priorizada" en el catálogo del panel de `/inicio` | 5b/11n | Ninguno — se puede hacer |
| D4 | "Fila por defecto del tablero" y "pantalla de inicio" en Configuración | 10b | La 1ª choca con el toggle actual (se resuelve con `sessionStorage`); la 2ª toca el redirect de login |
| D5 | "Asignar": disponibilidad real (carga del día por ingeniero, distancia) | 9e | Distancia necesita lat/lng (pendiente de otra tarea) |
| D6 | Almacén: bandeja "validar" (además de "arribos") | 11k | Toca el flujo de doble validación de piezas ya afinado — alto cuidado |
| D7 | Gantt: ancho 100% + zoom día/jornada/franja | 11h | `PX_HORA` fijo se usa en toda la matemática de arrastrar — riesgo si no se prueba en vivo |
| 7b | Fichas por entidad (cuentas Lexmark, sucursales) en Gerencia | 11q | Falta agregar encargados+ingenieros por sucursal a la consulta |
| — | Mapa por ingeniero | 11j | El wireframe mismo lo deja como imagen de referencia, no hay mapa real que construir todavía |
| — | Campo — agenda (`/campo`) y servicio en sitio (`/campo/[id]`) | t7b/t8b/8c | Pantallas solo-móvil para ingenieros; no hay forma de probarlas aquí (ni sesión de ingeniero ni gestos táctiles). La ficha verde ya tiene reglas propias afinadas. |

---

## Estado por pantalla (detalle)

| # | Pantalla | Ref. | Estado |
|---|---|---|---|
| 1 | Tablero `/tablero` | 11a | ✅ |
| 2 | Detalle de orden `/tablero/[id]` | 11e+11f | 🔧 ancho ampliado; ficha de color se conserva (D3) |
| 3 | Gantt del día `/tablero-dias` | 11g+11h+11i | 🔧 riel horizontal hecho; ancho 100%/zoom → D7 |
| 4 | Mapa por ingeniero | 11j | ⏳ sin empezar (ver tabla de arriba) |
| 5 | Almacén `/almacen` | 11k+11l | 🔧 riel + detalle + resumen; bandeja "validar" → D6 |
| 6 | Flujo de pedir pieza | 11m | ⏳ ya cubierto por `SeccionPiezas.tsx`, no se tocó |
| 7 | Gerencia `/gerencia/[recurso]` | 11p | ✅ |
| 7b | Fichas por entidad | 11q | ⏳ sin empezar |
| 8 | Campo — agenda `/campo` | t7b | ⏳ sin empezar (ver tabla de arriba) |
| 9 | Campo — servicio `/campo/[id]` | t8b/8c | ⏳ sin empezar (ver tabla de arriba) |
| 10 | Modal nueva orden | t9b | ✅ 2 pasos |
| 11 | Asignar sin modal | t9e | 🔧 panel hecho; disponibilidad real → D5 |
| 12 | Configuración `/configuracion` | t10b | 🔧 vista previa hecha; D4 pendiente |
| 13 | Login `/login` | t10d | ✅ |
| 14 | Inicio `/inicio` | 11n/11o | ✅ ancho completo; widget "cola priorizada" opcional (D1) |

## Notas de implementación

- Tokens nuevos del wireframe quedan de referencia en
  `scratchpad/wireframes/` (no se importan literal).
- `components/campo/*` (ficha verde de ingeniero) no se toca — riesgo
  alto sin poder probar en móvil, y ya tiene reglas propias afinadas.
