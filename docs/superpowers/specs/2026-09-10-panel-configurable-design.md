# Panel configurable como vista principal (`/inicio`)

**Fecha:** 2026-09-10
**Estado:** aprobado (diseño)
**Autor:** coordinación + Claude

## 1. Objetivo

Convertir `/inicio` en un panel de widgets que el usuario puede **reacomodar,
redimensionar y guardar** a su gusto. Reemplaza la vista de bienvenida actual
como render por defecto, sin eliminarla: queda disponible como "Vista simple".

El panel debe:

- Mostrarse **completo y con datos reales** al cargar (sin estado vacío).
- Ser consciente del rol (coordinador / gerencia / admin / almacén).
- Guardar el layout por usuario, sincronizado entre dispositivos.
- No romper nada de lo que hoy funciona en `/inicio`.

Fuera de alcance (YAGNI): filtros que operen dentro del panel, compartir
paneles entre usuarios, widgets que consulten datos por su cuenta, edición
de widgets en móvil, más de un preset guardado por usuario.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Personalización | `react-grid-layout` — rejilla libre, arrastrar + redimensionar |
| Persistencia | Tabla `preferencias_usuario` en Supabase con RLS por usuario |
| Gráficos | `chart.js` + `react-chartjs-2` |
| Ruta | Reemplaza el render de `/inicio`; la vista anterior se conserva como "Vista simple" |

## 3. Arquitectura

```
app/(app)/inicio/page.tsx        server — lee perfil, preferencia de vista,
                                          layout guardado y datosPanel; decide
                                          render (panel | simple)
components/panel/
  Panel.tsx                      client — react-grid-layout, modo ver/editar,
                                          barra del panel, guardar/cancelar
  WidgetShell.tsx                client — marco común (título, menú ⋯, asa)
  BarraPanel.tsx                 client — Personalizar / Agregar / Restablecer /
                                          Guardar / interruptor Panel⇄Simple
  widgets/
    KpiNumero.tsx                client-safe presentacional
    KpiMedidor.tsx               anillo SVG + número
    GraficoFlujo.tsx             react-chartjs-2 <Bar> (client)
    GraficoFases.tsx             react-chartjs-2 <Doughnut> (client)
    ListaPendientes.tsx
    AgendaHoy.tsx
    AlertasCriticas.tsx
    AccesosRapidos.tsx
    FiltrosRapidos.tsx
lib/panel/
  catalogo.ts                    definición de cada widget: id, título, w/h
                                  default y mínimo, roles, componente
  layout.ts                      tipos; layoutPorDefecto(rol); mergeLayout()
  datos.ts                       reutiliza lib/inicio/datos.ts + consultas nuevas
app/api/preferencias/route.ts    GET / PUT (upsert) de preferencias del usuario
```

### 3.1 Flujo de datos

1. `page.tsx` (server component, ya usa `createClient()` + `perfilActual()`):
   - `datos = await cargarDatosPanel(supabase, perfil)` — **un** `Promise.all`
     con todas las consultas.
   - `prefs = await leerPreferencias(supabase, ["inicio_vista", "panel_layout"])`.
   - Si `prefs.inicio_vista === "simple"` → renderiza `<Dashboard>` actual con
     `resumenInicio()` como hoy (código intacto).
   - Si no → `<Panel datos={datosPanel} layout={prefs.panel_layout} rol={...} />`.
2. `Panel.tsx` es cliente. Recibe todo por props. Los widgets son
   presentacionales: **ninguno hace fetch**. Reciben su rebanada de `datos`.
3. Guardar: `Panel` hace `PUT /api/preferencias` con
   `{ clave: "panel_layout", valor: { lg, md, sm, ocultos } }`.

### 3.2 react-grid-layout

- `WidthProvider(Responsive)`.
- Breakpoints: `lg` (≥1024, 12 col), `md` (≥768, 8 col), `sm` (<768, 1 col).
- En `sm`: una columna, `isDraggable={false}` `isResizable={false}` — en móvil
  solo se ve.
- Dos modos en `lg`/`md`:
  - **ver** (default): sin asas, sin cuadrícula de fondo, `isDraggable={false}`.
  - **editar**: `isDraggable` `isResizable` activos, fondo cuadriculado, cada
    `WidgetShell` muestra menú ⋯ (quitar, tamaño S/M/L rápido).
- CSS: importar `react-grid-layout/css/styles.css` y
  `react-resizable/css/styles.css` dentro de `Panel.tsx`. Re-tematizar
  `.react-grid-placeholder`, `.react-resizable-handle` en `globals.css` con
  tokens (`--brand`, `--border`).
- Instalación: `npm i react-grid-layout` + `npm i -D @types/react-grid-layout`.
  Si el peer de React 19 falla → `npm i --legacy-peer-deps`; documentarlo en el
  mensaje de commit.
- SSR: `Panel.tsx` lleva `"use client"`; RGL tolera SSR con `WidthProvider`.
  Si aparece warning de `window`, envolver el `Responsive` en un check
  `typeof window` con placeholder de altura fija (evita CLS).

### 3.3 Persistencia

Tabla creada con `execute_sql` (MCP `apply_migration` está bloqueado).
Registrar en `docs/cambios-bd-fuera-de-migraciones.md`.

```sql
create table public.preferencias_usuario (
  user_id        uuid not null references auth.users(id) on delete cascade,
  clave          text not null,
  valor          jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, clave)
);

alter table public.preferencias_usuario enable row level security;

create policy "prefs_select_propias" on public.preferencias_usuario
  for select using ((select auth.uid()) = user_id);
create policy "prefs_insert_propias" on public.preferencias_usuario
  for insert with check ((select auth.uid()) = user_id);
create policy "prefs_update_propias" on public.preferencias_usuario
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- sin delete: no hace falta
```

Claves usadas:

- `inicio_vista` — `"panel"` (default si no hay fila) | `"simple"`.
- `panel_layout` — `{ lg: LayoutItem[], md: LayoutItem[], sm: LayoutItem[], ocultos: string[] }`.

`LayoutItem` = `{ i: string, x: number, y: number, w: number, h: number }`
(el `i` es el id del widget del catálogo).

### 3.4 API

`app/api/preferencias/route.ts`:

- `GET ?clave=panel_layout` → `{ valor }` o `{ valor: null }` si no existe.
- `PUT` body `{ clave, valor }` → `upsert` sobre `(user_id, clave)` con
  `user_id` = usuario de sesión (nunca del body). Valida:
  - `clave ∈ { "inicio_vista", "panel_layout" }`.
  - `valor` tamaño < 32 KB.
  - Para `panel_layout`: forma mínima (`lg/md/sm` arrays, `ocultos` array).
- Errores → `{ error }` con status 400/401/500. RLS es la frontera real; la
  validación es cortesía.

El server component NO hace fetch a esta ruta: lee con el cliente SSR
directamente (`leerPreferencias()` en `lib/panel/datos.ts`).

## 4. Catálogo de widgets (v1)

`w`×`h` en unidades de rejilla `lg` (12 col, fila ≈ 56 px + margen).

| id | Título | def | mín | Roles | Datos |
|---|---|---|---|---|---|
| `alertas` | Alertas críticas | 12×2 | 6×2 | todos | SLA vencido, pieza detenida, reagendo sin confirmar |
| `kpi_activas` | Órdenes activas | 3×2 | 2×2 | coord, gerencia, admin | `ordenes` no cerradas (zona si aplica) |
| `kpi_sin_asignar` | Sin asignar | 3×2 | 2×2 | coord, gerencia, admin | `ingeniero_id is null`; tono warn si > 0 |
| `kpi_hoy` | Para hoy | 3×2 | 2×2 | coord, gerencia, admin | `fecha_eta = hoy` |
| `kpi_eta` | Cumplimiento ETA | 3×2 | 3×2 | coord, gerencia, admin | % ETA cumplida últimos 7 d; anillo SVG |
| `flujo` | Flujo semanal | 6×3 | 4×3 | coord, gerencia, admin | barras: proyectadas vs completadas, 6 días |
| `fases` | Distribución por fase | 6×3 | 4×3 | todos | dona: conteo por `estatus` de órdenes activas |
| `pendientes` | Órdenes por asignar | 6×4 | 4×3 | coord, gerencia, admin | igual que `resumenInicio().pendientes` |
| `agenda` | Agenda de hoy | 4×3 | 3×2 | coord, gerencia, admin | visitas por ingeniero hoy |
| `accesos` | Accesos rápidos | 4×2 | 3×2 | todos | Tablero, Agenda, Almacén, Gerencia (si aplica) |
| `filtros` | Filtros rápidos | 12×1 | 6×1 | coord, gerencia, admin | chips → `/tablero?…` (sin asignar, hoy, por marca) |
| `alm_validar` | Piezas por validar | 3×2 | 2×2 | almacen | rama `almacen` de `datos.ts` |
| `alm_minimo` | Bajo mínimo | 3×2 | 2×2 | almacen | inventario ≤ stock mínimo |
| `alm_arribos` | Arribos pendientes | 3×2 | 2×2 | almacen | `piezas_orden` en espera |

`layoutPorDefecto(rol)`:

- **coordinador / gerencia / admin:** `filtros` (fila 0), `alertas` (fila 1),
  `kpi_activas` `kpi_sin_asignar` `kpi_hoy` `kpi_eta` (fila 3), `flujo` + `fases`
  (fila 5), `pendientes` + `agenda` (fila 8), `accesos` (fila 12).
- **almacen:** `alertas`, `alm_validar` `alm_minimo` `alm_arribos`, `fases`,
  `accesos`.

`mergeLayout(guardado, rol)`: parte del `layoutPorDefecto(rol)`; para cada
widget permitido por rol, si hay posición guardada la usa; si el widget está en
`ocultos`, lo omite; ignora ids guardados que ya no existen en el catálogo o no
corresponden al rol.

### 4.1 Consultas nuevas en `lib/panel/datos.ts`

- **flujo semanal:** por cada uno de los últimos 6 días laborales,
  `count(fecha_eta = d)` (proyectadas) y `count(estatus='Concluido' and
  actualizado_en::date = d)` (completadas). Un solo query agrupado si se puede,
  si no 2 queries + agrupado en JS.
- **distribución por fase:** `select estatus, count(*) from ordenes where estatus
  not in (Concluido,Cancelado) [and zona] group by estatus`.
- **cumplimiento ETA 7 d:** `concluidas con actualizado_en::date <= fecha_eta` /
  `concluidas totales` en la ventana.
- **alertas:** 3 consultas acotadas (`limit`) — órdenes activas con `fecha_eta <
  hoy` sin concluir (SLA), piezas `en_espera` con > N días, órdenes
  `Reagendado` sin confirmación. Devuelve `[]` si no hay; el widget muestra
  "Sin alertas 👌".

Todas respetan la zona del coordinador igual que `datos.ts` (helper `match(zona)`).

## 5. Sidebar y logo (`components/AppShell.tsx`)

Cambios menores, sin tocar comportamiento (colapsar, drawer, backdrop ya
existen y se quedan):

- Header del contenido: mostrar monograma de empresa (AD/BD) + "Servicio
  Técnico" + eyebrow de la vista actual **también en escritorio** (hoy solo en
  móvil). El eyebrow lo pasa cada página vía un prop o `usePathname` → mapa.
- Igualar radios / paddings del sidebar y el translúcido del header al mockup
  (`backdrop-blur` + `bg-surface/80` + borde inferior).
- Sin cambios de rutas ni de items del NAV.

## 6. Manejo de errores

- API sin sesión → 401.
- `PUT` con `clave`/`valor` inválidos → 400, el panel muestra toast "No se pudo
  guardar" y **no** revierte el layout en pantalla (el usuario reintenta).
- `GET` que falla en el server component → se usa `layoutPorDefecto(rol)` y se
  registra en consola; el panel carga igual.
- Chart.js: los `<canvas>` viven en widgets cliente; si `datos` viene vacío,
  el gráfico muestra "Sin datos del periodo".
- `react-grid-layout` con layout corrupto en BD → `mergeLayout` lo sanea
  (descarta items sin `i` válido).

## 7. Pruebas y verificación

- `npx tsc --noEmit`, `npx eslint .`, `npx next build` — verdes.
- Supabase `get_advisors` (security + performance) tras crear la tabla.
- Manual, por rol (coordinador y gerencia como mínimo):
  1. `/inicio` carga con datos y layout por defecto.
  2. "Personalizar" → mover un widget, redimensionar otro, quitar uno,
     Agregar uno del catálogo, Guardar.
  3. Recargar → el layout persiste.
  4. "Restablecer" → vuelve al default del rol.
  5. Interruptor "Simple" → aparece el `Dashboard` viejo intacto; recargar
     mantiene "Simple"; volver a "Panel".
  6. Móvil (≤767): una columna, sin asas, sin barra de edición.
- Almacén: ve solo sus widgets; no aparecen los de coordinación.

## 8. Riesgos

- **Peer deps React 19.** Mitigación: `--legacy-peer-deps`, documentado.
- **CLS al montar RGL.** Mitigación: contenedor con `min-height` calculado del
  layout antes de hidratar.
- **Peso del bundle** (`react-grid-layout` + `chart.js` ≈ 110 KB gz). Aceptable
  para una vista interna; los gráficos se cargan solo en `/inicio`.
- **`actualizado_en::date` en consultas de flujo** puede no usar índice.
  Mitigación: rango `>= inicio_dia and < fin_dia` en vez de cast.
