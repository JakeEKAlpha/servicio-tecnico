# Lexmark OS — Arquitectura

> Migración de "Lexmark OS" (gestión de órdenes de servicio técnico) de
> Google Sheets + Apps Script a una app web. Documento vivo — actualízalo
> cuando cambie el diseño, no cuando cambie una línea.

Última revisión: 2026-09-11 — auditoría completa contra el código real (ver
`blueprints/cerrar-deuda-datos-blueprint.md` para el detalle de lo que
motivó esta actualización).

---

## 1. Panorama

```
Navegador ──► Next.js 16 (App Router)
                 ├─ app/(app)/*      páginas protegidas (Server Components)
                 ├─ app/api/*        route handlers = "backend"
                 ├─ app/login, /actualizar-password, /auth/confirm   públicas
                 └─ proxy.ts         refresca sesión + redirige en cada request
                        │
                        ▼
              Supabase Postgres (proyecto edahyqgfwcitzudvhlqd)
                 ├─ 8 tablas, RLS en todas
                 ├─ triggers = reglas de negocio que NO viven en la app
                 └─ Auth (cookies, @supabase/ssr)
                        │
                        ▼
              Google Docs + Drive API (cuenta de servicio)
                 └─ genera Doc + PDF de la orden de servicio
```

**Regla rectora:** las reglas de negocio del sistema viejo (máquina de
estatus, cascada de Concluido, cascada de piezas, marcadores de plantilla)
se replican **al pie de la letra**. No se inventa comportamiento.

---

## 2. Stack (decidido, no cambiar)

| Capa | Tecnología | Pin |
|---|---|---|
| Runtime | Node.js | 24 (local) · 20.9+ mínimo (Next 16) |
| Framework | Next.js App Router + Turbopack | `16.3.4` |
| Lenguaje | TypeScript `strict` | `^5` |
| UI | React 19.2 + Tailwind v4 | — |
| BD + Auth + Storage | Supabase | `@supabase/supabase-js ^2.116`, `@supabase/ssr ^0.12` |
| Documentos | Google Docs + Drive API | `@googleapis/docs ^10`, `@googleapis/drive ^22` |
| Deploy | Vercel | *pendiente* |
| Repo | GitHub | *pendiente* |

---

## 3. Modelo de datos (Supabase)

| Tabla | Para qué | Notas |
|---|---|---|
| `zonas` | 3 zonas (Zona 1, Zona 2, Baja Digital) | `coordinador_nombre`, `drive_folder_id` |
| `marcas` | Lexmark / Xerox / Propio | **las 3 migradas** — Xerox (captura manual) y servicios propios de Alpha Digital (renta/garantía/póliza/TyM) en producción desde `docs/plan-arquitectura-multimarca.md` (Fases A-D) |
| `perfiles` | usuarios de la app (FK `auth.users`) | `rol` enum, `zona_id`, `debe_cambiar_password` |
| `ingenieros` | catálogo (NO entran a la app) | `sucursal` (texto, no FK), `activo`, `nombre_corto` (carpetas Drive) |
| `ordenes` | una fila = una **visita** | `numero_orden` + `numero_visita`; `datos_especificos` jsonb (campos Lexmark); `cliente_id`/`equipo_id`/`contrato_id` (FK nullable, agregadas en Fase B — **aún sin poblar de forma sistemática**, ver Deuda) |
| `ordenes_historial` | auditoría de cambios de estatus | lo llena el trigger |
| `piezas_orden` | piezas por orden | `estado`: recomendada → en_espera → recibida → cancelada |
| `piezas_catalogo` | autocompletado de números de parte | |
| `clientes` | cuentas (antes `cuentas_lexmark`, renombrada y generalizada) | `nombre` unique, `tipo`, `contacto_*`, `gestor_id` |
| `equipos` | impresoras/equipos por cliente | FK `cliente_id` (nullable), `marca_id` (requerido), `modelo`, `serie` — **vacía en producción hoy**, la llena Gerencia |
| `contratos` | garantía/póliza/TyM — 3 valores de un mismo concepto | FK `cliente_id`, `equipo_id` (nullable = cubre todos los equipos), `tipo_contrato` (`text` + `CHECK`, no enum) — **vacía en producción hoy** |
| `inventario`, `movimientos_inventario` | almacén por sucursal | `sucursal_id` (uuid, FK a `sucursales` — **sí** usa id, a diferencia de `ingenieros`/`ordenes`) |
| `evidencias` | fotos/evidencia capturada desde `/campo` | FK `orden_id` |

**Inconsistencia conocida, no resuelta:** `ingenieros.sucursal` y `ordenes.sucursal` son texto
(nombre); `inventario.sucursal_id`/`movimientos_inventario.sucursal_id` son uuid FK a
`sucursales`. Documentado como Non-Goal en `blueprints/cerrar-deuda-datos-blueprint.md` — armonizar
esto toca el flujo de asignación de ingenieros (`SelectorIngenieroSucursal.tsx`), es un cambio de
mayor alcance que se hará como blueprint aparte.

### Enum `estatus_orden`
`Nuevo · Pendiente · Asignado · Reagendado · Pendiente por partes ·
Lista para realizar · Listo para continuar · Concluido · Cancelado`

Los dos del medio los pone **solo el sistema** (trigger de arribo de piezas);
no son seleccionables a mano.

### Triggers (la lógica que NO está en la app)

| Trigger | Cuándo | Qué hace |
|---|---|---|
| `trg_historial` | BEFORE UPDATE ordenes | registra cambio de estatus + `actualizado_en` |
| `trg_cascada_concluido` | AFTER UPDATE ordenes | al Concluir una visita, concluye TODAS las de la misma orden (salvo Cancelado) |
| `trg_piezas_arribo` | INS/UPD piezas_orden | al llegar la última pieza en_espera de una orden **Lexmark** en "Pendiente por partes": sin asignar → `Lista para realizar`; asignada → la visita N+1 → `Listo para continuar` |

Las 3 funciones-trigger son `SECURITY DEFINER` (necesitan escribir en tablas
con RLS) y tienen `revoke execute` a anon/authenticated (no se llaman por RPC).

### RLS

- `ordenes`, `perfiles`, `ingenieros`, `piezas_orden`: **por zona** — un
  coordinador solo ve/edita su `zona_id`; `gerencia`/`admin` ven todo.
- `marcas`, `zonas`, `piezas_catalogo`: lectura para cualquier autenticado.
- **RLS es la frontera de seguridad.** Los endpoints también validan, pero
  no son la última línea.

---

## 4. Backend (`app/api/*`)

| Endpoint | Réplica de | Estado |
|---|---|---|
| `POST /api/ordenes` | `crearOrdenRapida()` | ✅ + genera doc si nace Asignado |
| `GET /api/ordenes` | parte de datos de `reconstruirVistaGeneral()` | ✅ (vía `lib/ordenes/listar`) |
| `GET/PATCH /api/ordenes/[id]` | `cambiarEstatus()` / `guardarAsignacion()` | ✅ — el update, los triggers hacen el resto. `regenerar_doc:false` para el Gantt |
| `POST /api/importar/lexmark` | `agregarFilaCruda()` + `importarDesdeHoja()` | ✅ — parseo por posición (28 cols), sin encabezados, detecta WO/SR por 1ª celda |
| `POST /api/importar/xerox` | (nuevo — multimarca) | ✅ — captura de reportes Xerox (SR/tarea) |
| `POST /api/documentos/generar` | `generarDocumentoDesdeDatosDocumento()` | ✅ — copia plantilla → 16 marcadores → PDF → Unidad compartida |
| `GET/POST /api/ordenes/[id]/piezas`, `PATCH/DELETE /api/piezas/[id]` | (nuevo — Almacén) | ✅ |
| `GET/POST /api/inventario`, `PATCH/DELETE /api/inventario/[id]` | (nuevo — Almacén/Inventario) | ✅ |
| `GET/POST /api/movimientos` | (nuevo — trazabilidad de inventario) | ✅ |
| `GET/PATCH/DELETE /api/gerencia/[recurso]`, `/api/gerencia/[recurso]/[id]` | (nuevo — CRUD genérico de Gerencia) | ✅ — whitelist de tabla/columnas en `lib/gerencia/recursos.ts`; cubre ingenieros, sucursales, clientes, equipos, contratos |
| `GET/POST /api/campo/[ordenId]`, `POST /api/campo/[ordenId]/evidencia` | (nuevo — app de campo) | ✅ — checklist, evidencia fotográfica, dictado de voz para ingenieros |
| `GET/POST /api/preferencias` | (nuevo — Configuración) | ✅ — tema/densidad por usuario |
| `GET /api/auth/confirm` | (nuevo — enlaces de correo) | ✅ |

Patrón: cada handler valida sesión + lee `perfiles` + resuelve zona, luego
opera con RLS. **Duplicación conocida:** ese bloque se repite en varios handlers.

**Deuda nueva (auditoría 2026-09-11):** `POST /api/ordenes` no escribe `cliente_id`/`equipo_id`
todavía — ver `blueprints/cerrar-deuda-datos-blueprint.md`.

---

## 5. Frontend (`app/(app)/*` + `components/*`)

| Pantalla | Archivo | Estado |
|---|---|---|
| Tablero | `tablero/page.tsx` + `TablaOrdenes` + `AccionesOrden` | ✅ — chips de conteo, búsqueda, estatus inline, "Asignar" popup, aviso al Concluir, panel deslizante de detalle sin salir de la lista |
| Detalle de orden | `tablero/[ordenId]/page.tsx` + `DetalleOrdenCargado` + `SeccionPiezas` | ✅ — datos, cambiar estatus, asignar, doc, historial, piezas, cobertura de contrato (`CuentaLexmark`) |
| Tablero por día (Gantt) | `tablero-dias/page.tsx` + `GanttDia` | ✅ El arrastre en sí usa `PointerEvent` + `style.transform` por DOM directo (sin re-render de React), fluido. **Encontrado 2026-09-11:** soltar una tarjeta de "Sin agendar" se sentía lento/colgado — no es bug, el `PATCH` genera el Google Doc + PDF de verdad de forma síncrona antes de responder (varios segundos reales de Google). Arreglado el mensaje ("Generando documento…" en vez de "Guardando…"); la generación en sí sigue igual (congelada) |
| Almacén + Inventario | `almacen/page.tsx` + `AlmacenPiezas` | ✅ — en espera / en stock, confirmar arribo, riel de sucursales |
| Inicio (dashboard) | `inicio/page.tsx` + `Dashboard` + `panel/*` | ✅ — panel configurable por rol, widgets con drag/resize |
| Gerencia | `gerencia/page.tsx`, `gerencia/[recurso]/page.tsx` + `GestionRecurso`/`RielRecursos` | ✅ — CRUD genérico de ingenieros, sucursales, clientes, equipos, contratos. Esto **ya cubre** lo que el roadmap viejo llamaba "Panel de Gerencia" |
| Configuración | `configuracion/page.tsx` + `Configuracion` | ✅ — preferencias de usuario, vista previa en vivo de tema/densidad |
| Campo (app de ingenieros) | `app/(campo)/campo/[ordenId]` + `components/campo/*` | ✅ — checklist, evidencia fotográfica, dictado de voz. **Congelado** — no se toca fuera de una iniciativa dedicada a `/campo` |
| Login / recuperar / cambiar contraseña | `app/login`, `app/actualizar-password` | ✅ — pantalla partida |
| Modales | `ModalNuevaOrden`, `ModalPegarWOSR`, `ModalPegarXerox` | ✅ |

Convención: Server Component consulta directo con `createClient()`; Client
Component llama `fetch('/api/...')` + `router.refresh()`. Colores en
`lib/tema.ts`. Marca Alpha: azul `#203F7E`.

---

## 6. Autenticación (Fase 5)

- `proxy.ts` → `lib/supabase/proxy.ts`: refresca token, redirige sin-sesión →
  `/login`, con-sesión-en-`/login` → `/tablero`. `/api/*` no se redirige (401 propio).
- `lib/auth/sesion.ts` `perfilActual()`: chequeo real contra Supabase + perfil (DAL).
- Recuperación por correo → `/auth/confirm` (PKCE + token_hash).
- `debe_cambiar_password` en `perfiles` → el layout obliga a cambiarla.

Usuarios: 3 coordinadores + Fredy (gerencia). Ver `.claude` memory del proyecto.

---

## 7. Evaluación de salud

**Verde (verificado 2026-09-11):** `npx tsc --noEmit` limpio · `npm run lint` limpio ·
`npm run test` limpio (55 pruebas) · `get_advisors` sin hallazgos nuevos (Fase D de
`docs/plan-arquitectura-multimarca.md`) · reglas de negocio probadas con SQL contra los triggers
reales.

**Deuda técnica (por gravedad, actualizada):**

1. ~~Cero pruebas automatizadas~~ **Primera suite cerrada 2026-09-11** (`npm run test`, Vitest,
   55 pruebas): parsers Lexmark/Xerox, matching de clientes (`mejorCoincidenciaCliente`,
   incluye el caso real DHL EXPRESS vs DHL METROPOLITAN), prioridad de estatus, fechas/horas,
   normalización de texto. **Segunda ronda cerrada 2026-09-11:** componentes con jsdom
   (`SelectorIngenieroSucursal` — cubre el bug real de sucursal sin ingenieros) y un route
   handler con Supabase mockeado (`/api/gerencia/vincular-cliente`). 65 pruebas en total. Falta:
   más route handlers. Integración contra un branch de Supabase para triggers reales — decisión
   del usuario: fuera de alcance por ahora (costo real, no aprobado).
2. ~~BD sin versionar~~ **Cerrado 2026-09-11.** `supabase/migrations/20260911092901_remote_schema.sql`
   — primer baseline real vía `supabase db pull` (19 tablas, 75 funciones/triggers/políticas).
   De aquí en adelante, cambios de esquema van como migración nueva, no como SQL suelto.
3. ~~Sin CI, sin deploy~~ **Cerrado 2026-09-11.** `.github/workflows/ci.yml` corre
   `tsc`/`eslint`/`vitest`/`next build` en cada PR y push a `main`. Deploy real en Vercel:
   `https://lexmark-os-web.vercel.app` (conectado a GitHub — cada push a `main` dispara un deploy
   a producción automático). (Repo remoto: `github.com/JakeEKAlpha/servicio-tecnico`.)
4. ~~`ordenes.cliente_id`/`equipo_id` sin poblar~~ **Cerrado 2026-09-11.**
   `ModalNuevaOrden` tiene selector de cliente/equipo, `cuentaDeOrden()` prioriza el FK sobre el
   fuzzy-match, y el backfill de `/gerencia/cuentas` ya corrió sobre las órdenes históricas —
   `blueprints/cerrar-deuda-datos-blueprint.md`. Quedan 8 órdenes sin vincular porque su cliente
   (AUTOZONE MEXICO, DHL EXPRESS MEXICO, OPERADORA OMX ×5, AT&T COMUNICACIONES DIGITALES)
   **no existe todavía en `clientes`** — no es deuda de código, es que falta darlos de alta en
   Gerencia. Al agregarlos, "Correr backfill" (idempotente) los toma solo.
5. ~~14 políticas RLS sin optimizar~~ **Cerrado 2026-09-11.** `docs/db-optimizacion-rls.sql`
   aplicado por el usuario en el SQL editor de Supabase.
6. ~~Sucursal por texto vs por id~~ **Cerrado 2026-09-11.** `ordenes.sucursal_id` ya estaba
   resuelto por un trigger de BD (no era deuda real). La deuda real, más chica: `ingenieros` no
   tenía FK a `sucursales` y el selector de asignación armaba sus opciones de los valores únicos
   de `ingenieros.sucursal` en vez de la tabla canónica. `docs/ingenieros-sucursal-id.sql`
   aplicado por el usuario (ALTER TABLE + backfill); el selector ya lee `sucursales`.
7. **"Leaked password protection" sigue apagado — decisión 2026-09-11: no se activa.** El usuario
   confirmó que es un servicio de paga (plan Pro de Supabase), no un toggle gratis de 30 segundos
   como se pensaba. Queda descartado, no pendiente.
8. **`equipos`/`contratos` están vacíos en producción** — la feature de garantía/póliza/TyM está
   construida pero sin datos reales; los tiene que cargar Gerencia.
9. Menores: auth repetido en varios handlers · Gantt pendiente de re-verificar tras el pulido de
   wireframe · sin responsive/móvil confirmado end-to-end.

---

## 8. Ruta (orden recomendado — reescrito 2026-09-11, el anterior ya no reflejaba la realidad)

El roadmap anterior (AHORA/DESPUÉS/LUEGO) daba por pendiente trabajo que ya está hecho —
"Migrar Xerox/Propio" y "Panel de Gerencia" ya están en producción — y no mencionaba deuda real
que sí existe hoy. Reescrito contra el estado verificado.

### AHORA — Deuda de datos (prioridad #1, elegida por el usuario) — ✅ Cerrado 2026-09-11
- [x] Código: selector de cliente/equipo en Nueva orden, lectura por FK, backfill de un solo uso —
      `blueprints/cerrar-deuda-datos-blueprint.md`. `tsc`/`eslint`/`next build` limpios.
- [x] `docs/db-optimizacion-rls.sql` aplicado en el SQL editor de Supabase.
- [x] Backfill corrido desde `/gerencia/cuentas` — vinculó todo lo vinculable; 8 órdenes quedan
      pendientes solo porque su cliente no está dado de alta todavía (ver Deuda técnica #4).
- [ ] Pendiente, menor: dar de alta AUTOZONE MEXICO, DHL EXPRESS MEXICO, OPERADORA OMX, AT&T
      COMUNICACIONES DIGITALES en `/gerencia/cuentas` y volver a correr el backfill.

### DESPUÉS — Deuda de datos, segunda ronda
- [x] **`ingenieros.sucursal_id` + selector de asignación lee `sucursales`** — cerrado 2026-09-11
      (diagnóstico corregido: `ordenes.sucursal_id` no era la deuda real, ya lo resolvía un
      trigger). Ver Deuda técnica #6.
- [ ] Agregar vinculación manual similar a la de clientes también para casos borde de sucursal
      (typos en `ingenieros.sucursal` que el backfill exacto no haya podido resolver).
- [x] "Leaked password protection" — **descartado 2026-09-11**, es un servicio de paga (plan Pro
      de Supabase), no un toggle gratuito. Ver Deuda técnica #7.
- [x] **Gantt — cerrado 2026-09-11.** Reportado por el usuario: soltar una tarjeta se sentía
      colgado. Causa real: generación síncrona del Doc/PDF (varios segundos de Google), no un
      bug. Arreglado el mensaje ("Generando documento…"); ver Estado #5.

### LUEGO — Endurecer — ✅ Cerrado 2026-09-11 (los 4 puntos originales)
- [x] **CI** — `.github/workflows/ci.yml` (`tsc` + `eslint` + `vitest` + `next build` en cada PR
      y push a `main`).
- [x] **Suite de pruebas** — 65 pruebas (Vitest): parsers Lexmark/Xerox, matching de clientes,
      prioridad de estatus, fechas/hora, normalización de texto, un componente (jsdom) y un route
      handler (Supabase mockeado). Ver Deuda técnica #1 para lo que sigue faltando.
- [x] **`supabase/migrations/`** — `20260911092901_remote_schema.sql`, primer baseline real vía
      `supabase db pull` (necesitó instalar Docker Desktop y el CLI de Supabase en esta sesión).
- [x] **Deploy a Vercel** — `https://lexmark-os-web.vercel.app`, conectado a GitHub. **No quedó
      como staging** — el primer deploy manual cayó directo en producción (no hay forma de forzar
      preview en un proyecto recién creado sin pasar por un PR); el usuario decidió aceptarlo como
      el sitio real. Falta: `GOOGLE_SERVICE_ACCOUNT_KEY_B64` solo se cargó en el entorno
      Production de Vercel (no Preview/Development).
- [x] Integración de pruebas contra un branch de Supabase (triggers reales) — **decisión del
      usuario 2026-09-11: fuera de alcance por ahora.** Los branches de Supabase pueden tener
      costo real; no se crea sin aprobación explícita, y el usuario prefirió no aprobarlo todavía.
      Revisitar si se vuelve a considerar necesario.

### DESPUÉS DE ESO — Features
- [ ] Notificaciones / realtime (Supabase Realtime).
- [ ] Cargar `equipos`/`contratos` reales desde Gerencia (la feature ya existe, falta la data).
- [ ] Reportes / métricas.
- [ ] Confirmar responsive end-to-end en tablero/detalle/Gantt en pantallas chicas.
