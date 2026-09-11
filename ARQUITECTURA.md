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
| `empresas` | Alpha Digital / Baja Digital — **nueva 2026-09-11** | `nombre` unique. Formaliza lo que antes era texto libre repetido en `sucursales.empresa`/`ingenieros.empresa` y embebido en `zonas.nombre` |
| `zonas` | 3 zonas (Alpha Digital Zona 1, Zona 2, Baja Digital) | `coordinador_nombre`, `drive_folder_id`, `empresa_id` (FK, nuevo 2026-09-11 — el nombre de la zona no se tocó, sigue diciendo la empresa en texto) |
| `marcas` | Lexmark / Xerox / Alpha Digital ("Propio") / HP | **`es_partner` — nuevo 2026-09-11**: `true` solo en Lexmark y Xerox (partners oficiales); "Alpha Digital"/HP en `false` — hacen TyM sobre equipos de cualquier fabricante, pero solo son partner de esas dos. CRUD en `/gerencia/marcas` para agregar más marcas (Brother, Epson…) sin migración nueva |
| `perfiles` | usuarios de la app (FK `auth.users`) | `rol` enum, `zona_id`, `debe_cambiar_password` |
| `ingenieros` | catálogo (NO entran a la app) | `sucursal` (texto, no FK), `activo`, `nombre_corto` (carpetas Drive), `empresa_id` (FK, nuevo 2026-09-11) |
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
| Reportes (análisis de servicios) | `gerencia/reportes/page.tsx` + `components/gerencia/reportes/*` | ✅ — KPIs, SLA, distribución, tendencia; ver Deuda de datos, ítem "Reportes / métricas" |
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
4. ~~`ordenes.cliente_id`/`equipo_id` sin poblar~~ **Cerrado por completo 2026-09-11.**
   `ModalNuevaOrden` tiene selector de cliente/equipo, `cuentaDeOrden()` prioriza el FK sobre el
   fuzzy-match, y el backfill de `/gerencia/cuentas` corrió sobre todas las órdenes históricas —
   `blueprints/cerrar-deuda-datos-blueprint.md`. Los 4 clientes que faltaban (AUTOZONE MEXICO,
   DHL EXPRESS MEXICO, OPERADORA OMX, AT&T COMUNICACIONES DIGITALES) ya están dados de alta y
   el backfill final corrió limpio: **0 órdenes sin match.**
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
- [x] **Cerrado 2026-09-11.** Los 4 clientes dados de alta en `/gerencia/cuentas` (AUTOZONE
      MEXICO, DHL EXPRESS MEXICO, OPERADORA OMX, AT&T COMUNICACIONES DIGITALES — entre el usuario
      y el agente) y el backfill final corrió limpio: 0 órdenes sin match.

### DESPUÉS — Deuda de datos, segunda ronda
- [x] **`ingenieros.sucursal_id` + selector de asignación lee `sucursales`** — cerrado 2026-09-11
      (diagnóstico corregido: `ordenes.sucursal_id` no era la deuda real, ya lo resolvía un
      trigger). Ver Deuda técnica #6.
- [x] **Casos borde de sucursal — cerrado 2026-09-11, sin componente nuevo.** No hacía falta una
      UI de vinculación manual: `sucursal_id` ya es un campo editable en el panel de Gerencia de
      Ingenieros (agregado en la ronda anterior). 7/23 ingenieros habían quedado sin `sucursal_id`
      tras el backfill exacto — no por typos, sino porque `sucursales.nombre` siempre lleva el
      prefijo de empresa ("Alpha Digital Mérida") y `ingenieros.sucursal` a veces solo trae la
      ciudad ("Mérida"). Corregidos 3 (Mérida ×2, Cancún ×1); los 4 restantes son ingenieros de
      "Soporte"/"Soporte Chiapas" sin sucursal física — correcto que queden sin vincular. 19/23
      con `sucursal_id` ahora.
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
- [ ] **Notificaciones push — Fase 1 cerrada 2026-09-11, Fase 2 pendiente.** Web Push real (PWA +
      service worker), no in-app ni Realtime. 13 disparadores en 3 roles:

      | Rol | Disparador | Tipo | Estado |
      |---|---|---|---|
      | Ingeniero | Nueva asignación | Evento | ✅ Fase 1 |
      | Ingeniero | Pieza disponible (apartada) | Evento | ✅ Fase 1 |
      | Ingeniero | Hora del ETA sin marcar inicio | Programado | ⏳ Fase 2 |
      | Ingeniero | +2h desde inicio sin marcar salida | Programado | ⏳ Fase 2 |
      | Ingeniero | Documentación pendiente (30min/1h/2h post-cierre) | Programado | ⏳ Fase 2 |
      | Coordinación | Pieza arribó al almacén | Evento | ⏳ Fase 2 |
      | Coordinación | Nuevo servicio entrante | Evento | ⏳ Fase 2 |
      | Coordinación | Urge asignar (SLA corto, usa `horasParaVencerSla`) | Programado | ⏳ Fase 2 |
      | Coordinación | No han documentado | Programado | ⏳ Fase 2 |
      | Coordinación | Resumen 5:00pm (pendientes/no realizados/no documentados) | Programado, diario | ⏳ Fase 2 |
      | Gerencia | Caso extremo: >3 servicios no realizados, por ingeniero individual | Programado | ⏳ Fase 2 |
      | Gerencia | Ingeniero no documenta — 2+ veces en la misma semana | Programado | ⏳ Fase 2 |
      | Gerencia | Retraso +2h — mismo evento que el del ingeniero, copia a gerencia | Programado | ⏳ Fase 2 |

      **Fase 1** (nueva asignación + pieza disponible): construida, migrada, desplegada — ver
      `lib/push/*`, `public/sw.js`, `components/campo/ActivarNotificaciones.tsx`.

      **Fase 2** necesita cron externo (decisión del usuario: cron-job.org gratis, cada 15 min,
      no Vercel Pro) llamando a un endpoint nuevo que revise los 9 disparadores programados de
      una vez + el resumen diario. Ese endpoint corre sin sesión de usuario → necesita
      `SUPABASE_SERVICE_ROLE_KEY` (Supabase Dashboard ▸ Settings ▸ API) como variable de entorno,
      que el usuario tiene que agregar — es una credencial real de su proyecto, el agente no la
      genera ni la maneja.

      Fuera de alcance de esta pantalla (es reporte, no reordenamiento): la pantalla de
      análisis/reportes con justificantes del SLA (ver el ítem de Reportes abajo) sí usa un
      dashboard de referencia que el usuario diseñó — el reordenamiento del Tablero (ya cerrado,
      ver Deuda técnica) es distinto y no depende de esto.
- [ ] Cargar `equipos`/`contratos` reales desde Gerencia (la feature ya existe, falta la data).
- [x] **Reportes / métricas — pantalla de análisis de servicios (`/gerencia/reportes`).**
      Adaptada del dashboard ejecutivo de referencia (`dashboard_ejecutivo_work_orders.html`) que
      compartió el usuario, con una decisión explícita de alcance: **no lee el Google Sheet
      "DATOS WO"** (eso seguía sin resolverse — ver historial) **ni inventa las columnas que ahí
      llena un humano** (`VALIDEZ DEL SLA`, `JUSTIFICANTE`, etc., instrucción del usuario: "no
      inventes campos, no crees, paréalos, respeta los filtros, usa la lógica"). En su lugar,
      empareja los mismos conceptos del dashboard de referencia con datos que la app YA captura:
      - Fuente: `ordenes` + `ordenes_historial` (cierre real = última transición a "Concluido").
        Cero tablas o columnas nuevas.
      - Cumplimiento de SLA: reutiliza la MISMA regla que ordena la cola del Tablero
        (`calcularFechaLimiteSla` en `lib/ordenes/sla.ts`, extraída de `horasParaVencerSla` para
        que sea una sola fuente de verdad) — WO usa `Customer Committed Completion Date`, SR usa
        creado+22 días. Es mecánico a propósito: **no** captura los motivos de retraso que a
        veces etiqueta Lexmark (ej. "DELAYED DUE TO CUSTOMER") porque esa columna no forma parte
        de las 28 que hoy importa `lib/importar/lexmark.ts` — se documenta como limitación
        conocida, no se inventa el dato.
      - Filtros: fecha (creado_en), zona, sucursal, marca, ingeniero, origen (WO/SR/manual),
        estatus — mismo concepto de filtro que el dashboard de referencia, catálogos reales.
      - KPIs: total, activas, % cumplimiento SLA (solo sobre lo evaluable), vencidas abiertas
        ahora mismo, días promedio de cierre. Gráficas: distribución por estatus (dona, reusa
        `GraficoFases` del panel de `/inicio`), tendencia semanal creadas/concluidas (reusa
        `GraficoFlujo`), por tipo de servicio y cumplimiento por ingeniero (nuevo
        `GraficoBarrasCategoria`). Tabla detalle ordenable por columna + lista de "atención
        inmediata" (SLA vencido, sigue abierta).
      - Acceso: gateado por `app/(app)/gerencia/layout.tsx` (gerencia/admin), igual que el resto
        de Gerencia — la pregunta de si "gerente de análisis" es un rol propio sigue sin
        resolverse, se usó el rol existente.
      - **Caveat real, verificado en vivo (2026-09-11):** la BD de producción tiene solo 12
        órdenes (el proyecto Supabase se creó el 2026-09-09) y ninguna Lexmark concluida todavía
        — las gráficas de cumplimiento por ingeniero y de tendencia se ven dispersas hasta que
        se acumule historial real. Es esperado, no un bug: el "DATOS WO" del usuario tiene
        historial del sistema viejo que esta pantalla, por diseño, no importa.
      - Pendiente, fuera de este alcance: si en algún momento se decide leer el Sheet en vivo
        (como el HTML de referencia) para ver historial pre-2026-09-09, es una decisión aparte
        que el usuario no ha confirmado — no se implementó aquí.
      Código: `lib/reportes/analitica.ts` (puro, 15 pruebas), `lib/reportes/datos.ts` (fetch +
      filtros, 4 pruebas), `app/(app)/gerencia/reportes/page.tsx`,
      `components/gerencia/reportes/{ReportesClient,FiltrosReportes,GraficoBarrasCategoria}.tsx`.

      **Auditoría post-implementación (2026-09-11) — 2 bugs reales encontrados y corregidos**
      (latentes hoy porque producción no tiene ninguna orden Cancelada todavía, pero se iban a
      manifestar con datos reales):
      1. Una orden **Cancelada** cuya fecha límite de SLA ya había pasado se contaba como
         "vencida abierta" — `estadoSla()` no distinguía Cancelado de "sigue activa". Corregido:
         Cancelado siempre da `no_aplica`.
      2. Una orden **Concluido sin fila en `ordenes_historial`** (dato insertado a mano, sin pasar
         por el trigger) se evaluaba como si siguiera abierta — podía salir como "vencida" en vez
         de comparar su cierre real contra el límite. Corregido: si falta el historial, usa
         `actualizado_en` (columna real, no inventada) como mejor aproximación del cierre.
      Verificación en vivo repetida tras el fix: mismos 12/3/— que antes (el dataset actual no
      tiene canceladas ni huecos de historial, así que no cambia lo que se ve hoy — el fix
      previene un número incorrecto el día que sí haya una orden cancelada con SLA vencido).
- [x] **Responsive — verificado 2026-09-11 (375px, mobile).** `/tablero` (tarjetas), detalle de
      orden y `/tablero-dias` revisados en vivo con sesión real. Sin bugs encontrados — el Gantt
      necesita scroll horizontal para ver más de ~2 horas a la vez, esperable en este tipo de
      vista (igual que un calendario semanal). No se probó drag-and-drop táctil real (solo visual).

### AHORA — Rediseño de interfaz (iniciativa amplia, decisión del usuario 2026-09-11)

Alcance confirmado por el usuario: **toda la app**, incluido `/campo` (deja de estar
"congelado" para efectos de UI/UX — la lógica de generación de documento/PDF y el formato de
captura WO/SR siguen intactos, esa parte del congelamiento no cambió). Objetivo: que se sienta
fluida, intuitiva, personalizable, fresca y cohesiva entre pantallas. Se usa la skill
`impeccable` (plugin de diseño) para el proceso.

- [x] **`PRODUCT.md` y `DESIGN.md` creados** (antes no existían). `DESIGN.md` documenta el
      sistema ya incumbente (no lo reemplaza): tokens de `lib/ui.ts`/`lib/tema.ts`/
      `app/globals.css`, motion Kowalski-style ya implementado, densidad ajustable. Norte
      creativo elegido por el agente (el usuario delegó explícitamente el tono/nombre): "La
      Consola Alpha". Sidecar `.impeccable/design.json` generado también.
      **Nota de proceso:** la interview de `document`/`init` normalmente pide nombrar el
      "Creative North Star" y el tono al usuario en una ronda de preguntas aparte; se sustituyó
      por criterio propio porque el usuario ya había delegado esa decisión explícitamente
      ("que tú decidas") en la ronda de preguntas anterior sobre posicionamiento/referencias.
- [x] **`craft-floor.md` aplicado — limpieza de bans reales encontrados:**
      - Emoji usados como ícono de UI (no como voz de marca en copy) en `RielRecursos.tsx`
        ("📊 Reportes"), `ActivarNotificaciones.tsx` ("🔔"), `ServicioCampo.tsx` ("🔒", "🖨",
        "▶") — reemplazados por íconos reales de `lib/iconos.tsx` (lucide-react). Se agregó
        `Bloqueado` (Lock) y `Analitica` (BarChart3) al set.
      - Botones en mayúsculas en `/campo` ("INICIAR SERVICIO", "GENERAR ORDEN DE SERVICIO",
        "ENVIAR REPORTE FINAL Y CERRAR") — pasados a formato normal (regla de Micro-Caps: solo
        etiquetas de campo/grupo van en mayúsculas, nunca botones).
      - `border-l-4` decorativo en la lista de "Mis órdenes" de `/campo` (acento verde fijo sin
        relación con el estado real de la orden) — quitado; reemplazado por una señal real:
        chip "Hoy" (reusa `bg-hl-today`, mismo token que ya resalta la fecha de hoy en
        `TablaOrdenes`) o "Atrasada" (`tone-rojo`) cuando aplica.
      - `<button>` con ícono local (`IconoBasura` en `SeccionPiezas.tsx`) duplicando lo que ya
        existía en `lib/iconos.tsx` como `Basura` — consolidado.
- [x] **Consolidación de color en `/campo`:** todo el módulo (`ServicioCampo.tsx`,
      `app/(campo)/campo/page.tsx`, `layout.tsx`, `DictadoVoz.tsx`, `GrupoEvidencia.tsx`,
      `PiezasCampo.tsx`) usaba un verde hardcodeado (`#00A859`/`#004B25`) **sin soporte de modo
      oscuro** — un tercer verde distinto de `--marca-lexmark` y `--success`. Reemplazado por
      el token `--success` ya existente (mismo verde de "éxito" que usan Almacén y Piezas) —
      cero tokens nuevos, modo oscuro correcto gratis, y una app que se ve más "parte de lo
      mismo" en vez de 3 verdes distintos sin relación.
- [ ] **Verificación visual en vivo de `/campo` pendiente.** Se verificó con `tsc`/`eslint`/
      `vitest` (114 pruebas)/`next build`, y con el detector mecánico de `impeccable`
      (`impeccable detect`, 0 hallazgos tras corregir la escala tipográfica de `DESIGN.md`).
      No se pudo tomar captura en vivo autenticado como ingeniero en esta sesión (la pestaña
      del navegador perdió la sesión y el agente no puede iniciar sesión con credenciales
      reales). Pendiente confirmar visualmente con el usuario o en la próxima sesión.
- [x] **Insignia de SLA visible en Tablero y Gantt** (antes solo ordenaba, no se veía —
      recomendación de la investigación de apps similares). `lib/ordenes/listar.ts` expone
      `horas_sla` (ya se calculaba para ordenar, antes se descartaba); `badgeSla()` nuevo en
      `lib/ordenes/sla.ts` decide cuándo mostrarla — **solo si es accionable** (vencida, o vence
      en ≤24 h) para no llenar la tabla de insignias en cada orden Lexmark. Se ve en
      `TablaOrdenes` (tarjeta móvil + tabla escritorio) y en la cola "Sin agendar" del Gantt.
      7 pruebas nuevas.
- [x] **Auditoría con el detector mecánico de `impeccable` sobre TODA la app** (69 archivos):
      solo 5 hallazgos, la mayoría documentación de `DESIGN.md` incompleta, no defectos reales.
      - `GanttDia.tsx`: el acento `border-l-4` por marca en la cola "Sin agendar" se reemplazó
        por un punto de color (mismo patrón que ya usa `TablaOrdenes` para lo mismo) — resuelve
        el aviso y unifica el tratamiento de "qué marca es esta orden" en un solo patrón.
      - `AlmacenPiezas.tsx`: mismo `border-l-4 border-brand` que usa `encabezadoSeccion` en TODA
        la app — **excepción deliberada, documentada en `DESIGN.md`** (es el encabezado de
        sección establecido en decenas de pantallas, no una decoración de una sola fila;
        rediseñarlo es un cambio de sistema aparte, no una limpieza incidental de esta pasada).
      - 2 avisos de tipografía (documentación de `DESIGN.md` incompleta, no código) y 1 de color
        (`#0b1220` en `app/layout.tsx` es el mismo `--bg` oscuro, usado en `<meta
        theme-color>` porque el navegador no puede leer variables CSS ahí) — documentados.
- [x] **Límites de error/404 con marca propia** (`app/error.tsx`, `app/not-found.tsx`,
      `app/global-error.tsx`) — no existían; cualquier excepción sin capturar o ruta/orden
      inexistente caía en la pantalla genérica de Next.js, sin marca y sin salida clara. Ahora
      siguen la identidad de `loading.tsx` (azul Alpha, monograma) con botón de reintentar/volver
      al Tablero. `global-error.tsx` usa estilos inline a propósito (única excepción a la regla
      de tokens, documentada en `DESIGN.md`): solo se dispara si el propio `layout.tsx` truena,
      sin garantía de que la hoja de estilos global esté cargada. Revisé que `GestionRecurso` y
      `AlmacenPiezas` ya tenían hover/transition consistentes — no hacía falta un pase de motion
      adicional ahí, el hallazgo real estaba concentrado en `/campo` (ya cerrado arriba).
- [x] **Personalización: Reportes recuerda los últimos filtros usados.** Reusa
      `preferencias_usuario` (misma tabla del panel de `/inicio`, sin migración nueva) con la
      clave `reportes_filtros`. Una visita CON filtros en la URL los guarda como "los últimos
      usados" (fire-and-forget, no bloquea el render); una visita SIN ningún filtro los
      recupera — salvo `?limpio=1` (el link "Limpiar"), que respeta la intención explícita de
      empezar en blanco y no los vuelve a cargar. `esFiltrosReportes()` en
      `app/api/preferencias/route.ts` valida forma (objeto plano, solo las 8 claves conocidas,
      todo texto) — 5 pruebas nuevas. Sincronizar tema/densidad de Configuración de la misma
      forma (hoy solo `localStorage`) queda fuera de esta pasada a propósito: es un cambio de
      alcance/arquitectura (decide si las preferencias siguen al usuario entre dispositivos),
      no una tarea visual.
- [ ] **Pendiente:** verificación visual en vivo de Tablero/Gantt/Reportes/`error.tsx`/
      `not-found.tsx`/filtros recordados con sesión real (el navegador de esta sesión no tiene
      login y el agente no puede introducir credenciales — nota: una ruta inexistente sin sesión
      redirige a `/login` antes de llegar a `not-found.tsx`, así que ese límite en particular
      solo se puede probar autenticado); y el `impeccable-finish-reviewer` formal (necesita
      capturas de pantalla que no se pudieron tomar por la misma razón).
