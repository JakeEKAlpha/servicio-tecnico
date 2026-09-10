# Lexmark OS — Arquitectura

> Migración de "Lexmark OS" (gestión de órdenes de servicio técnico) de
> Google Sheets + Apps Script a una app web. Documento vivo — actualízalo
> cuando cambie el diseño, no cuando cambie una línea.

Última revisión: 2026-09-10

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
| `marcas` | Lexmark / Xerox / Propio | hoy solo Lexmark migrado |
| `perfiles` | usuarios de la app (FK `auth.users`) | `rol` enum, `zona_id`, `debe_cambiar_password` |
| `ingenieros` | catálogo (NO entran a la app) | `sucursal`, `activo`, `nombre_corto` (carpetas Drive) |
| `ordenes` | una fila = una **visita** | `numero_orden` + `numero_visita`; `datos_especificos` jsonb (campos Lexmark) |
| `ordenes_historial` | auditoría de cambios de estatus | lo llena el trigger |
| `piezas_orden` | piezas por orden | `estado`: recomendada → en_espera → recibida → cancelada |
| `piezas_catalogo` | autocompletado de números de parte | |

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
| `POST /api/documentos/generar` | `generarDocumentoDesdeDatosDocumento()` | ✅ — copia plantilla → 16 marcadores → PDF → Unidad compartida |
| `GET/POST /api/ordenes/[id]/piezas`, `PATCH/DELETE /api/piezas/[id]` | (nuevo — Almacén) | ✅ |
| `GET /api/auth/confirm` | (nuevo — enlaces de correo) | ✅ |

Patrón: cada handler valida sesión + lee `perfiles` + resuelve zona, luego
opera con RLS. **Duplicación conocida:** ese bloque se repite en 3 handlers.

---

## 5. Frontend (`app/(app)/*` + `components/*`)

| Pantalla | Archivo | Estado |
|---|---|---|
| Tablero | `tablero/page.tsx` + `TablaOrdenes` + `AccionesOrden` | ✅ — chips de conteo, búsqueda, estatus inline, "Asignar" popup, aviso al Concluir |
| Detalle de orden | `tablero/[ordenId]/page.tsx` + `DetalleOrden` + `SeccionPiezas` | ✅ — datos, cambiar estatus, asignar, doc, historial, piezas |
| Tablero por día (Gantt) | `tablero-dias/page.tsx` + `GanttDia` | ⚠️ funcional pero **el arrastre se siente torpe** |
| Almacén por sucursal | `almacen/page.tsx` + `AlmacenPiezas` | ✅ — en espera / en stock, confirmar arribo |
| Login / recuperar / cambiar contraseña | `app/login`, `app/actualizar-password` | ✅ |
| Modales | `ModalNuevaOrden`, `ModalPegarWOSR` | ✅ |

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

**Verde:** `next build` limpio · `tsc` + `eslint` sin warnings · security
advisors resueltos (salvo el toggle de "leaked password protection", que es
del dashboard) · reglas de negocio probadas con SQL contra los triggers reales.

**Deuda técnica (por gravedad):**

1. **Cero pruebas automatizadas.** Lógica delicada sin red de regresión.
2. **BD sin versionar** — DDL aplicado como SQL suelto, no como `supabase/migrations/`.
3. **Sin repo remoto, sin CI, sin deploy.**
4. **Nunca se probó el flujo completo en navegador con un usuario real.**
5. **Generación de docs probada 1 vez** — sin reintentos ni cola.
6. Menores: auth repetido ×3 · Gantt sin pulir · multi-marca sin probar · sin responsive/móvil.

---

## 8. Ruta (orden recomendado)

### AHORA — Frontend (lo pidió el usuario, antes de GitHub)
- [ ] **Sistema visual coherente** — tokens de tema theme-aware, arreglar contraste en dark mode, un layout consistente.
- [ ] **Gantt usable** — arrastre fluido, línea de "ahora", crear/reasignar sin fricción.
- [ ] **Badge "piezas listas"** en el tablero para las órdenes en `Lista para realizar` / `Listo para continuar`.
- [ ] **Panel de Gerencia** — ver todas las zonas, cancelar órdenes (único que puede).
- [ ] **Responsive** — el tablero y el detalle en pantallas chicas.
- [ ] **Prueba end-to-end manual** con sesión real: crear → asignar → doc → pendiente por partes → almacén → lista para realizar.

### DESPUÉS — Endurecer
- [ ] Volcar todo el DDL a `supabase/migrations/`.
- [ ] Crear repo GitHub + CI (`tsc` + `eslint` + `next build` en cada PR).
- [ ] Suite de pruebas (Vitest): parser Lexmark, helpers fecha/hora, máquina de estatus, marcadores; integración contra un branch de Supabase para los triggers.
- [ ] Deploy a Vercel (staging) + validar generación de docs en ese runtime.

### LUEGO — Features
- [ ] Notificaciones / realtime (Supabase Realtime).
- [ ] Migrar Xerox / Propio.
- [ ] Reportes / métricas.
