---
name: Servicio Técnico · Alpha Digital
description: Consola operativa de servicio técnico multimarca (Lexmark, Xerox, HP) para Alpha Digital / Baja Digital
colors:
  azul-alpha: "#203f7e"
  azul-alpha-600: "#1b356a"
  azul-alpha-050: "#eef2fb"
  rojo-alpha: "#e53325"
  gris-alpha: "#c6c6c6"
  verde-lexmark: "#008a44"
  ambar-lexmark-sr: "#e0a93b"
  rojo-xerox: "#d92231"
  fondo: "#f4f6f9"
  superficie: "#ffffff"
  superficie-2: "#f1f5f9"
  borde: "#e5e7eb"
  texto: "#1e293b"
  texto-muted: "#64748b"
  peligro: "#dc2626"
  exito: "#15803d"
typography:
  micro:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 800
    letterSpacing: "0.04em"
  meta:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
  label:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 800
  body:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  subtitulo:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
  titulo:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 800
  title:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    letterSpacing: "-0.01em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.azul-alpha}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  button-primary-hover:
    backgroundColor: "{colors.azul-alpha-600}"
  button-secondary:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.md}"
  chip:
    rounded: "{rounded.full}"
    padding: "3px 7px"
  card:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
---

# Design System: Servicio Técnico · Alpha Digital

## Overview

**Creative North Star: "La Consola Alpha"**

El sistema ya en código es maduro, no un borrador: tokens de tema claro/oscuro completos,
motion afinado (transform+opacity, ease-out, `prefers-reduced-motion` respetado), y una
densidad de información alta pero disciplinada. La Consola Alpha es la metáfora que ya vive
implícita en el producto — un centro de control de despacho técnico donde el color de cada
orden es una **señal de instrumento**, no decoración: verde Lexmark, ámbar para lo proactivo,
rojo Xerox, azul Alpha. Cada pantalla (oficina o campo) es una vista distinta de la misma
consola, nunca un producto aparte.

Este redisño extiende esa consola — más fluida (motion con propósito en más lugares donde hoy
falta), más personalizable (ya existe el panel configurable de `/inicio`; se expande el
concepto), más fresca (sin perder la seriedad de un socio autorizado Lexmark/Xerox) — sin
reemplazar ni un token de marca.

**Key Characteristics:**
- Azul Alpha domina la marca; los colores de Lexmark/Xerox/ámbar son semáforo de tipo de
  servicio, nunca acento decorativo suelto.
- Una sola familia tipográfica (Montserrat) en toda la app, densidad de producto por encima de
  la jerarquía editorial.
- Superficies planas con `shadow-sm` como techo — la profundidad la da el contraste tonal
  (superficie vs. superficie-2), no la sombra.
- Motion contenido: 150–260 ms, `ease-out` o `cubic-bezier(0.16,1,0.3,1)`, solo
  transform+opacity, siempre coherente con `prefers-reduced-motion`.
- Tema claro/oscuro completo desde el día uno — cualquier componente nuevo hereda ambos, nunca
  un valor hex suelto.

## Colors

Paleta de marca restringida y con roles fijos — no hay "colores decorativos" sueltos.

### Primary
- **Azul Alpha** (`#203f7e`, `--brand`): navegación, acciones primarias, marca. Domina toda
  superficie de identidad (encabezados, banda de marca, botón primario).

### Secondary
- **Rojo Alpha** (`#e53325`, `--red`): acento de marca puntual — no es el color de peligro
  (ese es `--danger`, `#dc2626`, distinto a propósito).

### Marca de servicio (rol único de este producto — la "señal de instrumento")
- **Verde Lexmark** (`#008a44`, `--marca-lexmark`): órdenes WO Lexmark.
- **Ámbar Lexmark proactivo** (`#e0a93b`, `--marca-lexmark-sr`): SR / servicio proactivo.
- **Rojo Xerox** (`#d92231`, `--marca-xerox`): órdenes Xerox.
- **Azul Alpha** (`--marca-alpha`): todo lo demás (Alpha Digital propio).

**The Signal, Not Decoration Rule.** Los 4 colores de marca de servicio identifican **qué tipo
de orden es** (Gantt, tarjetas, chips de tipo) y nunca se usan como acento decorativo en otro
contexto — un botón, un ícono suelto o un fondo de sección jamás toman "verde Lexmark" solo
porque combina.

### Neutral
- **Fondo** (`#f4f6f9`): fondo de página.
- **Superficie** (`#ffffff`): tarjetas, paneles, modales.
- **Superficie 2** (`#f1f5f9`): segunda capa tonal — sidebars, filas alternas, estado hover.
- **Borde** (`#e5e7eb`): divisores y contornos, siempre sutil.
- **Texto** (`#1e293b`) / **Texto muted** (`#64748b`): jerarquía tipográfica, nunca un tercer gris.

### Named Rules
**The Token-Only Rule.** Ningún componente usa hex crudo — siempre una utilidad semántica
(`bg-surface`, `text-muted`, `bg-tone-*`, `text-brand`). Ya es la regla escrita en
`app/globals.css`; este redisño la hereda sin excepción, campo incluido.

Nota: los valores de modo oscuro (ej. `--bg: #0b1220`) viven en el bloque
`@media (prefers-color-scheme: dark)` / `:root[data-theme="dark"]` de `app/globals.css`, no
repetidos aquí — evita duplicar dos veces la misma paleta. `app/layout.tsx` referencia
`#0b1220` directamente solo para `<meta name="theme-color">` (el navegador no puede leer
variables CSS ahí); es el mismo valor de `--bg` oscuro, no un color nuevo.

## Typography

**Body/Display/Label Font:** Montserrat (con `system-ui, sans-serif` de respaldo).

**Character:** una sola familia geométrica, de trazo confiable — no hay pareja
display/body como en un sitio de marca; la densidad de producto manda (`operate.md`: "One
family is often right").

### Hierarchy
Escala real observada — más pasos que un sitio de marca porque el producto es denso
(`operate.md`: "more type elements here than on brand surfaces"):
- **Título** (extrabold 800, 16–18px, `tracking-tight`): encabezados de pantalla y de tarjeta
  (`encabezadoSeccion`), fichas grandes de `/campo`.
- **Subtítulo** (bold 700, 14px): nombres de cliente/cuenta en tarjeta, cabeceras de card.
- **Cuerpo/valor** (medium 500, 13px): texto normal de formularios, celdas, tarjetas.
- **Etiqueta de botón/chip** (extrabold 800, 12px, formato normal — nunca mayúsculas): la
  acción o el estado, en una palabra cuando es posible.
- **Meta / dato secundario** (bold 700, 11px): número de orden, fecha, ubicación — texto de
  apoyo junto al valor principal.
- **Etiqueta de campo/grupo** (extrabold 800, 10px, mayúsculas, `tracking-wide`): la única
  mayúscula-siempre del sistema — nunca en botones, pestañas o chips.

### Named Rules
**The Micro-Caps Rule.** Mayúsculas + tracking ancho se reservan para etiquetas de campo y
encabezados de grupo/riel. Un botón, una pestaña o un chip en mayúsculas es una regresión.

## Layout

Grid basado en Tailwind v4, sin `tailwind.config` (tokens vía `@theme inline` en
`globals.css`). Tarjetas compactas (`padding: 10px`, `radius: 8–10px`) en vez de tarjetas
grandes y aireadas. Densidad ajustable por el usuario (`data-densidad="compacta"` en
Configuración, reduce paddings de tabla). El panel de `/inicio` ya usa una rejilla libre
(`react-grid-layout`, breakpoints `lg` 12 col / `md` 8 col / `sm` 1 col, sin arrastre en `sm`).
Rieles de navegación lateral (`RielRecursos`) pasan de columna a fila en `md`.

## Elevation & Depth

Sistema plano por defecto: la profundidad la da el contraste tonal entre `--surface` y
`--surface-2`, no la sombra. `shadow-sm` es el techo — no hay una escala de elevación mayor.

### Shadow Vocabulary
- **Tarjeta** (`shadow-sm`, transición suave en tarjetas interactivas): único nivel de sombra
  en reposo.
- **Modal** (`shadow-2xl`): única superficie que sube de nivel, y solo porque flota sobre un
  overlay con blur — no hay elevación intermedia.

### Named Rules
**The Flat-by-Default Rule.** Las superficies están planas en reposo; la sombra aparece solo
como respuesta a interactividad (`tarjetaInteractiva` se eleva y sombrea al hover) o para una
superficie que literalmente flota (modal). Nunca como decoración de una tarjeta estática.

## Shapes

Esquinas suaves y consistentes, nunca esquinas vivas: `rounded-lg` (8px) es el default de
botones/inputs/tarjetas, `rounded-xl` (10–12px) para superficies mayores (modales, tarjetas de
panel), `rounded-full` reservado a chips/insignias — nunca un botón de acción es pastilla
completa salvo que sea un chip de estado.

**Excepción deliberada — `encabezadoSeccion` (`border-l-4 border-brand`).** El detector
mecánico de diseño marca cualquier `border-l-4` como "tell" genérico de IA. Este caso es
distinto: es el encabezado de sección de TODA la app (decenas de pantallas ya lo usan),
siempre del mismo azul de marca — no decorativo ni variable por fila. Se mantiene a propósito
en este redisño en vez de rediseñarlo de cero, para no tocar decenas de pantallas de un jalón;
si se retira algún día, es un cambio deliberado del sistema, no una limpieza incidental. La
misma señal en contexto de LISTA (marca de servicio por fila, ej. la cola de "Sin agendar" del
Gantt) sí se resolvió con un punto de color en vez de un borde — ver `colorOrden().punto`.

## Components

### Buttons (`lib/ui.ts`)
- **Shape:** `rounded-lg` (8px), altura mínima 34px (28px en variante mini de celda de tabla).
- **Primary:** fondo `--brand`, texto `--brand-fg`, `shadow-sm`, `active:scale-[0.98]`.
- **Secondary/Ghost:** borde `--border`, fondo `--surface`, hover a `--surface-2`.
- **Peligro:** fondo `--danger` (nunca `--red` de marca — son roles distintos a propósito).
- **Deshabilitado:** pierde el relleno de color y pasa a `--surface-2`/`--muted` — nunca solo
  baja opacidad, para que "puedo tocarlo" y "no puedo" se noten sin leer el texto.
- **Etiqueta:** una palabra, formato normal — nunca mayúsculas ni una frase.

### Chips (`chip`, `lib/tema.ts`)
- **Style:** `rounded-full`, `10px` extrabold, fondo/texto tonal (`bg-tone-*-bg` /
  `text-tone-*-fg`) — nunca color sólido saturado de fondo.
- **State:** un tono por significado semántico (`TONO_ESTATUS`, `TONO_PIEZA`), no por marca —
  el color de marca de servicio vive en la tarjeta/barra, no en el chip de estatus.

### Cards / Containers (`tarjeta`, `tarjetaInteractiva`)
- **Corner Style:** `rounded-lg`.
- **Background:** `--surface` sobre `--bg`.
- **Shadow Strategy:** ver Elevation — `shadow-sm` en reposo, se acentúa solo si es interactiva.
- **Border:** `--border`, 1px, siempre sutil.
- **Internal Padding:** 10px (compacto, wireframe-driven).

### Inputs / Fields (`campo`)
- **Style:** borde `--border`, fondo `--surface`, `rounded-lg`, 34px de alto, texto 13px medium.
- **Focus:** borde `--brand` + anillo `--brand/25` — nunca solo un cambio de color de borde sin
  anillo (accesibilidad de foco visible es una regla ya escrita, `foco` en `lib/ui.ts`).
- **Etiqueta:** micro-mayúscula 10px arriba del campo (`etiqueta`).

### Navigation (`AppShell`, `RielRecursos`)
- Sidebar colapsable + drawer en móvil, header translúcido (`backdrop-blur` + `bg-surface/80`).
- Riel de recursos agrupado por categoría (no 8 pestañas en fila) — patrón a repetir cuando
  una sección crezca en vez de amontonar tabs.

### Signature component: marca de agua de marca (`FichaOrden`)
El nombre de la marca aparece como marca de agua tipográfica (`text-[4rem]`, `opacity-.06`) en
la esquina de la ficha de orden — decorativo de fondo, no contenido, por eso está fuera de la
escala tipográfica de la sección anterior a propósito.

### Signature component: Gantt/Tablero por marca (`colorOrden`, `GanttDia`)
Barra de orden coloreada por `colorOrden(origen, marca)` — el único lugar donde el color de
marca de servicio se pinta como superficie sólida (barra), reforzando la regla de "señal, no
decoración": en cualquier otra parte esos mismos colores solo aparecen como acento tonal chico.

## Do's and Don'ts

### Do:
- **Do** usar siempre una utilidad semántica de color (`bg-surface`, `text-brand`,
  `bg-tone-warn-bg`) — nunca un hex suelto, en ninguna pantalla nueva.
- **Do** limitar el motion a `transform` + `opacity`, 150–260 ms, `ease-out` o
  `cubic-bezier(0.16,1,0.3,1)`, y heredar `prefers-reduced-motion` sin excepción.
- **Do** reservar los 4 colores de marca de servicio (verde/ámbar/rojo Xerox/azul) para
  identificar tipo de orden — Gantt, tarjetas, badges de tipo — nunca como acento suelto.
- **Do** mantener una sola familia tipográfica (Montserrat) y el vocabulario de peso ya
  establecido (extrabold para etiquetas/botones/chips, medium para cuerpo).
- **Do** dar estado `disabled` visualmente distinto (pierde color, no solo opacidad) en todo
  control nuevo.

### Don't:
- **Don't** introducir una segunda familia tipográfica o una fuente "display" para títulos —
  el producto es Operate, no Persuade.
- **Don't** subir la escala de sombra por encima de `shadow-sm` en reposo — la profundidad es
  tonal, no de elevación.
- **Don't** usar el color de marca de servicio (verde/ámbar/rojo Xerox) como decoración fuera
  de su rol de identificar tipo de orden.
- **Don't** tocar la lógica de generación de documento/PDF ni el formato de captura de WO/SR al
  hacer trabajo visual — es una regla de negocio congelada, no de UI (ver `PRODUCT.md`).
- **Don't** usar mayúsculas fuera de etiquetas de campo/grupo — nunca en botones, pestañas ni chips.
