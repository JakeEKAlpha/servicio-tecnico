# Cerrar deuda de datos (clientes/equipos + RLS) — Blueprint

> Generado por The Architect (modo brownfield/clone) el 2026-09-11
> Shape: cambio sobre SaaS interno existente · repo: `lexmark-os-web` (servicio-tecnico)
> Runtime track: TypeScript/Node (el ya usado por el repo — sin cambios)
> Emisión: archivo único (5 pasos, bajo el umbral de 12 para bundle)
> Blueprint version: 1
> Adaptación de proceso: sin research de versiones (0 dependencias nuevas) ni smoke-test de
> bootstrap en scratch dir (no hay scaffolding — el proyecto ya existe y corre). Ver §11.

---

## 1. Project Overview & Non-Goals

### Current state (Repo Map — verificado 2026-09-11)

- **Stack:** Next.js `16.3.4` (App Router, Turbopack) · React `19.2.8` · TypeScript `strict ^5` ·
  Tailwind v4 · Supabase (`@supabase/supabase-js ^2.116`, `@supabase/ssr ^0.12`) · Google
  Docs/Drive API para PDFs.
- **Salud verificada ahora mismo:** `npx tsc --noEmit` limpio · `npm run lint` limpio. Sin
  `supabase/migrations/` (DDL suelto). Sin pruebas automatizadas. Sin CI. Remoto sí existe:
  `github.com/JakeEKAlpha/servicio-tecnico`.
- **Módulos en producción** (más de lo que documentaba `ARQUITECTURA.md` antes de esta sesión):
  tablero + detalle + Gantt (Lexmark/Xerox/Alpha Digital), almacén + inventario/movimientos,
  `/campo` (app de ingenieros: checklist, evidencia, dictado de voz), `/inicio` (dashboard
  configurable), `/gerencia` (CRUD genérico de recursos vía `RECURSOS` config en
  `lib/gerencia/recursos.ts`), `/configuracion`.
- **La deuda concreta que este blueprint cierra**, documentada en
  `docs/plan-arquitectura-multimarca.md`: las tablas `clientes`/`equipos`/`contratos` existen y
  están en producción desde las Fases A-D (commit `0151249` y anteriores), y `ordenes` ya tiene
  las columnas `cliente_id`/`equipo_id`/`contrato_id` (nullable) — **pero nada las escribe
  todavía**. El emparejamiento de contrato en el detalle de orden sigue dependiendo de
  `cuentaDeOrden()` (`lib/cuentas/directorio.ts:99`), un fuzzy-match por nombre normalizado,
  ejecutado en caliente en cada carga de página.
- `equipos` y `contratos` están **vacíos** en producción hoy — los llenará el usuario desde
  Gerencia. Esto acota lo que se puede hacer ahora: **`cliente_id` se puede backfillear
  (`clientes` sí tiene datos reales); `equipo_id`/`contrato_id` no** (nada contra qué emparejar
  todavía). Ver Non-Goals.

### Target state

- `ModalNuevaOrden` gana un selector opcional de cliente (y de equipo, si el cliente tiene
  equipos cargados) que escribe `cliente_id`/`equipo_id` directamente al crear una orden — ya no
  depende de que el texto libre coincida por fuzzy-match.
- Toda orden histórica con un cliente identificable queda con `cliente_id` poblado por un
  backfill de una sola vez.
- La lectura del contrato/cliente en el tablero usa el FK directo cuando existe y solo cae al
  fuzzy-match para órdenes que quedaron sin backfill (huérfanas) — **cero regresión visual**.
- Las 14 políticas RLS señaladas por el advisor `auth_rls_initplan` quedan optimizadas
  (`docs/db-optimizacion-rls.sql`, ya escrito, semántica idéntica) y las 3 tablas con políticas
  SELECT duplicadas quedan unificadas.

### Users
| Persona | Qué vienen a hacer | Frecuencia |
|---|---|---|
| Coordinador de zona | Crea/edita órdenes; ahora puede vincular cliente/equipo al crear | Diaria |
| Gerencia | Ve cobertura de contrato correcta y consistente en el detalle de orden | Diaria |

### Goals — alcance de este cambio
1. Toda orden nueva puede vincularse a un `cliente_id`/`equipo_id` real desde su creación.
2. Toda orden histórica con cliente identificable queda vinculada por backfill, una sola vez.
3. La lectura de contrato/cliente en el detalle de orden prioriza el FK sobre el fuzzy-match.
4. Las políticas RLS de 7 tablas quedan optimizadas y sin duplicados, con semántica de permisos
   idéntica a la actual.

### Non-Goals — explícitamente fuera de alcance de este cambio

| No se hace aquí | Por qué no ahora | Revisitar cuando |
|---|---|---|
| Armonizar `ordenes.sucursal` (texto) vs `sucursal_id` (uuid) | Resultó ser un cambio de mayor alcance: la app entera (ingenieros, `SelectorIngenieroSucursal`) usa sucursal por **nombre**, no por id — solo `inventario`/`movimientos_inventario` usan `sucursal_id`. Armonizarlo tocaría el flujo de asignación de ingenieros, que funciona hoy y el usuario no pidió tocar. | Cuando se decida invertir en unificar el modelo de sucursal en todo el repo — blueprint aparte |
| Backfill de `equipo_id`/`contrato_id` en órdenes históricas | `equipos`/`contratos` están vacíos en producción — no hay nada contra qué emparejar todavía | Cuando Gerencia haya cargado equipos/contratos reales |
| Activar "leaked password protection" | Toggle manual en el dashboard de Supabase, fuera del alcance de cualquier herramienta automatizada | Cuando el usuario lo active a mano (una vez, 30 segundos) |
| Versionar el DDL en `supabase/migrations/`, CI, pruebas automatizadas | Deuda real pero de otra naturaleza (tooling/proceso, no modelo de datos); ya está en el roadmap "Endurecer" de `ARQUITECTURA.md` | Próximo ciclo, blueprint aparte |
| Tocar `/campo` o el flujo de piezas | Explícitamente congelado por el usuario para esta ronda | No aplica a este blueprint |
| Tocar generación de PDF o captura/formato de WO-SR | **No negociable** — el usuario lo marcó como intocable | Nunca dentro de un blueprint de "deuda de datos" |

### Success metrics
| Métrica | Objetivo | Cómo se mide |
|---|---|---|
| Órdenes históricas con `cliente_id` poblado | 100% de las que tienen un match ≥60 puntos en `cuentaDeOrden` | `select count(*) from ordenes where cliente_id is not null` antes/después del backfill (Paso 2) |
| Órdenes nuevas creadas con selector | 100% de las creadas desde `ModalNuevaOrden` después del Paso 1 | Revisión manual de las primeras 5 órdenes creadas tras el deploy |
| Políticas RLS optimizadas | 0 hallazgos nuevos de `auth_rls_initplan` sobre las 7 tablas listadas | `get_advisors` (Supabase) o inspección manual de `pg_policies` (Paso 4) |

---

## 2. Tech Stack

**Sin cambios.** Este blueprint no agrega ninguna dependencia — usa exactamente lo que el repo ya
tiene instalado (Next.js, Supabase JS, TypeScript). Ver §11 para la razón por la que no se corrió
`stack-researcher`.

### Compatibility check
No aplica — no se introduce ningún paquete nuevo ni se cambia ninguna versión existente.

---

## 3. Directory Structure — Delta

```
lib/cuentas/directorio.ts        # MODIFICA: cuentaDeOrden() gana un 3er parámetro opcional clienteId
lib/gerencia/recursos.ts         # SIN CAMBIOS — se reutiliza tal cual para leer clientes/equipos
components/ModalNuevaOrden.tsx   # MODIFICA: agrega selector de cliente/equipo (Paso 1)
components/tablero/
  DetalleOrdenCargado.tsx        # MODIFICA: pasa orden.cliente_id a cuentaDeOrden()
components/CuentaLexmark.tsx     # SIN CAMBIOS (consume el resultado ya resuelto, no la lógica)
app/api/ordenes/route.ts         # MODIFICA: acepta y guarda cliente_id/equipo_id en el INSERT
scripts/backfill-clientes.ts     # NUEVO — script de backfill de un solo uso (Paso 2)
docs/db-optimizacion-rls.sql     # SIN CAMBIOS DE CONTENIDO — se aplica tal cual (Paso 4, manual)
ARQUITECTURA.md                  # MODIFICA — fuera de este blueprint, actualizado por separado
```

**Reglas de límite:** `scripts/` es de un solo uso — no se integra a ningún build ni CI; se corre
una vez con `npx tsx scripts/backfill-clientes.ts` y se borra o se deja como referencia histórica.
`app/(campo)/**` no aparece en ningún paso de este blueprint — no se toca.

---

## 4. Data Model — Delta

**Sin cambios de esquema.** `ordenes.cliente_id`, `ordenes.equipo_id`, `ordenes.contrato_id` ya
existen (nullable, FK a `clientes`/`equipos`/`contratos`) desde la Fase B de
`docs/plan-arquitectura-multimarca.md`. Este blueprint solo cambia **quién las escribe y quién las
lee** — cero `ALTER TABLE`.

### Relaciones que este cambio empieza a usar
- `ordenes.cliente_id` →(N:1)→ `clientes.id` — se escribe en creación (Paso 1) y por backfill
  (Paso 2). `ON DELETE`: hereda el que ya tiene la FK (sin cambio).
- `ordenes.equipo_id` →(N:1)→ `equipos.id` — se escribe solo en creación (Paso 1); sin backfill
  (tabla vacía hoy, ver Non-Goals).

### Migraciones
No aplica — no hay migración de esquema. El backfill del Paso 2 es un `UPDATE` de datos, no una
migración de estructura.

---

## 5. API Design — Delta

### Interfaces held constant (congeladas, no se tocan en este cambio)
| Superficie | Por qué queda igual |
|---|---|
| `POST /api/documentos/generar` y todo `lib/documentos/*` | Generación de PDF — no negociable, el usuario lo marcó intocable |
| `POST /api/importar/lexmark`, `POST /api/importar/xerox` y sus parsers en `lib/importar/*` | Captura/formato de WO-SR — no negociable |
| `GET /api/ordenes`, `GET/PATCH /api/ordenes/[id]` | Sin cambio de forma — solo el `POST` gana 2 campos opcionales |

### Delta
| Método | Ruta | Cambio |
|---|---|---|
| `POST` | `/api/ordenes` | Body acepta `cliente_id?: string \| null` y `equipo_id?: string \| null` (ambos opcionales, nullable). Si vienen, se insertan tal cual en `ordenes`; si no vienen, se insertan `null` — **comportamiento actual preservado byte a byte** para cualquier cliente que no mande estos campos (ej. el importador Lexmark/Xerox, que no cambia). |

---

## 6. Frontend Architecture — Delta

`ModalNuevaOrden.tsx`, Paso 1: bajo el campo `Cliente *` (texto libre, que se conserva sin cambios
para no romper el flujo actual), se agrega un segundo control opcional: un `<select>` buscable
"Vincular a cliente existente (opcional)" poblado desde `clientes` (mismo patrón que el selector de
`marcas` que ya recibe la modal como prop). Si el usuario elige un cliente, un segundo `<select>`
"Equipo (opcional)" aparece, poblado desde `equipos` filtrados por ese `cliente_id` y por el
`marca_id` ya elegido. Ninguno de los dos es obligatorio — `paso1Ok` no cambia su condición.

Todo lo demás (Paso 2 "Agendar", el resto de campos, el flujo de envío) **sin cambios**.

---

## 7. Design System

**NOT APPLICABLE — este cambio no introduce ningún componente visual nuevo.** Los dos `<select>`
nuevos reutilizan las clases ya existentes (`campo`, `etiqueta` de `lib/ui.ts`), igual que cada
campo ya presente en la modal.

---

## 8. Authentication & Authorization

**NOT APPLICABLE al flujo de auth en sí** — este cambio no toca sesión, login, ni roles. La única
superficie relacionada es RLS (políticas de autorización a nivel de fila), cubierta en el Paso 4 y
en la sección siguiente.

### Multi-tenancy / row-level isolation (lo que sí cambia: rendimiento, no semántica)

`docs/db-optimizacion-rls.sql` reescribe las políticas de `perfiles`, `ingenieros`, `ordenes`,
`ordenes_historial`, `piezas_orden`, `inventario`, `movimientos_inventario`, `evidencias` para
envolver `auth.uid()`/`es_gerencia()`/`es_encargado_de()` en `(select …)` — se evalúan una vez por
consulta en vez de una vez por fila (advisor `auth_rls_initplan`, 14 hallazgos) — y unifica las
políticas SELECT duplicadas de `perfiles`/`ingenieros`/`inventario`. **La regla de negocio no
cambia**: gerencia/admin ven y editan todo; coordinador ve/edita lo de su zona; encargado de
almacén gestiona su(s) sucursal(es) — el propio script lo declara en su encabezado y este blueprint
no reescribe una sola condición de negocio, solo la forma de evaluarla.

---

## 9. BUILD ORDER

**5 pasos.** Ninguno introduce una dependencia nueva; todos los comandos de `Verify` son los reales
de este repo (`npx tsc --noEmit`, `npm run lint`, `npm run build`) más consultas SQL directas contra
Supabase donde aplica.

#### Paso 1 — Selector de cliente/equipo en "Nueva orden" + API

**Do**
- `lib/cuentas/directorio.ts`: agregar una función `listarClientesOpciones(supabase)` que
  devuelve `{id, nombre}[]` de `clientes` ordenados por nombre, y `listarEquiposDeCliente(supabase,
  clienteId, marcaId)` que devuelve `{id, modelo, serie}[]` de `equipos` filtrados por ambos.
- `app/(app)/tablero/page.tsx` (o el server component que ya arma las props de
  `ModalNuevaOrden`): pasar `clientes={await listarClientesOpciones(supabase)}` como nueva prop.
- `components/ModalNuevaOrden.tsx`: agregar `clientes: {id:string; nombre:string}[]` a las props,
  estado `cliente_id: string` y `equipo_id: string` en `Datos` (default `""`), los dos `<select>`
  descritos en §6, y enviarlos en `guardar()` como `cliente_id: d.cliente_id || null, equipo_id:
  d.equipo_id || null`.
- `app/api/ordenes/route.ts`: en el `INSERT` de la orden (cerca de la línea 209, donde ya se
  resuelve `marca_id`), leer `cliente_id`/`equipo_id` del body (`?? null`) e incluirlos en el
  objeto insertado.

**Done when**
- [ ] WHEN se abre "Nueva orden" THE SYSTEM SHALL mostrar el selector "Vincular a cliente
      existente (opcional)" poblado con las cuentas de `clientes`.
- [ ] WHEN se elige un cliente con equipos registrados THE SYSTEM SHALL mostrar el selector de
      equipo filtrado a ese cliente y esa marca.
- [ ] WHEN se envía el formulario sin tocar los selectores nuevos THE SYSTEM SHALL crear la orden
      exactamente como hoy, con `cliente_id` y `equipo_id` en `null`.
- [ ] WHEN se envía el formulario con cliente y equipo elegidos THE SYSTEM SHALL crear la orden
      con `ordenes.cliente_id` y `ordenes.equipo_id` iguales a los ids elegidos.
- [ ] WHEN `POST /api/ordenes` recibe un body sin `cliente_id`/`equipo_id` (como hoy manda el
      importador) THE SYSTEM SHALL insertar la orden sin error, con ambas columnas en `null`.

**Verify**
```bash
npx tsc --noEmit                      # expect: exit 0, sin errores nuevos
npm run lint                          # expect: exit 0, sin warnings nuevos
```
```sql
-- Contra la BD, tras crear una orden de prueba desde la UI con cliente+equipo elegidos:
select cliente_id, equipo_id from ordenes order by creada_en desc limit 1;
-- expect: ambos no-null, con los ids del cliente/equipo elegidos en la prueba manual
```

**Checkpoint**
```bash
git add -A && git commit -m "step 1: selector de cliente/equipo en Nueva orden"
git tag step-01-selector-cliente-equipo
```

---

#### Paso 2 — Backfill de `cliente_id` en órdenes históricas

**Do**
Crear `scripts/backfill-clientes.ts` — script Node de un solo uso (usa el mismo cliente de
Supabase con service role que ya usan otros scripts del repo, o `lib/supabase/server.ts` si aplica
en contexto script). Lógica:
1. `select id, cliente, cliente_id from ordenes where cliente_id is null`.
2. Para cada fila, reutilizar la función de emparejamiento ya existente en `lib/cuentas/directorio.ts`
   (la misma lógica de puntaje que `cuentaDeOrden`, factorizada si hace falta en una función pura
   `mejorCoincidenciaCliente(clientes, nombreObjetivo)` para no depender de un `SupabaseClient` en
   el script) contra el listado completo de `clientes`.
3. Si el puntaje ≥ 60 (el mismo umbral que ya usa `cuentaDeOrden` para considerar match), `update
   ordenes set cliente_id = <id> where id = <orden.id>`.
4. Imprimir al final: total de filas procesadas, cuántas quedaron vinculadas, cuántas sin match
   (con su `cliente` de texto, para revisión manual).

Idempotente: correrlo dos veces no cambia nada la segunda vez, porque el `WHERE cliente_id is
null` excluye lo ya vinculado.

**Done when**
- [ ] WHEN el script corre sobre una orden cuyo texto de cliente coincide ≥60 puntos con una fila
      de `clientes` THE SYSTEM SHALL dejar `ordenes.cliente_id` con ese id.
- [ ] WHEN el script corre una segunda vez sin cambios en `clientes` THE SYSTEM SHALL reportar 0
      filas adicionales actualizadas (ya no hay `cliente_id is null` que coincida de nuevo... las
      que no coincidieron la primera vez tampoco coincidirán la segunda, así que el conteo de
      "sin match" se mantiene igual).
- [ ] WHEN termina el script THE SYSTEM SHALL imprimir el conteo de: procesadas, vinculadas, sin
      match.

**Verify**
```bash
npx tsx scripts/backfill-clientes.ts
# expect: imprime "procesadas: N, vinculadas: M, sin match: N-M" con N = count(*) de ordenes antes del backfill
```
```sql
select count(*) filter (where cliente_id is not null) as con_fk,
       count(*) filter (where cliente_id is null)     as sin_fk
from ordenes;
-- expect: con_fk aumentó respecto a antes de correr el script; sin_fk son las que de verdad no
-- tienen un cliente reconocible en `clientes` (revisar a mano, no es un error)
```

**Checkpoint**
```bash
git add -A && git commit -m "step 2: backfill de cliente_id en ordenes historicas"
git tag step-02-backfill-clientes
```

---

#### Paso 3 — Lectura prioriza el FK, cae al fuzzy-match solo si falta

**Do**
- `lib/cuentas/directorio.ts`: cambiar la firma de `cuentaDeOrden` a
  `cuentaDeOrden(supabase, cliente, clienteId?: string | null)`. Si `clienteId` viene, hacer
  `select` directo por `id` (sin loop de puntaje) y devolver esa cuenta; si no viene o no se
  encuentra, ejecutar exactamente la lógica de fuzzy-match que ya existe hoy, sin cambios.
- `components/tablero/DetalleOrdenCargado.tsx:71`: cambiar la llamada a
  `cuentaDeOrden(supabase, orden.cliente, orden.cliente_id)`.
- **`app/(campo)/campo/[ordenId]/page.tsx:55` NO se toca** — sigue llamando
  `cuentaDeOrden(supabase, orden.cliente)` con la firma de 2 argumentos, así que su comportamiento
  es idéntico byte a byte al de hoy. Esto es intencional: `/campo` está congelado para este cambio.

**Done when**
- [ ] WHEN `DetalleOrdenCargado` carga una orden con `cliente_id` no nulo THE SYSTEM SHALL mostrar
      la cuenta correspondiente a ese id, sin ejecutar el loop de fuzzy-match.
- [ ] WHEN `DetalleOrdenCargado` carga una orden con `cliente_id` nulo THE SYSTEM SHALL mostrar el
      mismo resultado que mostraba antes de este cambio (fuzzy-match sobre `orden.cliente`).
- [ ] WHEN se compara la ficha de una orden ya vinculada (Paso 2) antes y después de este paso
      THE SYSTEM SHALL mostrar la misma cuenta/contrato — cero regresión visual.
- [ ] WHEN se abre `/campo/[ordenId]` para cualquier orden THE SYSTEM SHALL comportarse
      exactamente igual que antes de este blueprint (archivo no tocado).

**Verify**
```bash
npx tsc --noEmit     # expect: exit 0 — la nueva firma con parámetro opcional no rompe el único
                     # otro call site (/campo), que sigue pasando 2 argumentos
npm run lint         # expect: exit 0
npm run build        # expect: exit 0
```
```bash
git diff --stat -- 'app/(campo)/**'
# expect: salida vacía — ningún archivo bajo app/(campo)/ aparece en el diff de este paso
```

**Checkpoint**
```bash
git add -A && git commit -m "step 3: cuentaDeOrden prioriza cliente_id sobre fuzzy-match"
git tag step-03-lectura-por-fk
```

---

#### Paso 4 — Aplicar la optimización de RLS (manual, en Supabase SQL editor)

**Do**
Este paso es **manual** — el propio `docs/db-optimizacion-rls.sql` documenta que el classifier de
esta cuenta bloquea `DROP/ALTER POLICY` en modo automático. No hay código de app que cambiar:
1. Abrir el SQL editor del proyecto Supabase (`edahyqgfwcitzudvhlqd`).
2. Pegar y correr el contenido completo de `docs/db-optimizacion-rls.sql` (ya escrito, sin
   modificar — está dentro de un único `begin ... commit`).
3. Correr inmediatamente la verificación que el propio script deja en su pie.

**Done when**
- [ ] WHEN el script corre completo THE SYSTEM SHALL dejar exactamente una política SELECT por
      tabla en `perfiles`, `ingenieros`, `inventario`, `movimientos_inventario` (antes: 2 cada
      una).
- [ ] WHEN un coordinador autenticado consulta el tablero después de aplicar el script THE SYSTEM
      SHALL seguir viendo solo las órdenes de su zona (sin cambio de comportamiento).
- [ ] WHEN gerencia consulta cualquiera de las 7 tablas THE SYSTEM SHALL seguir viendo todo
      (sin cambio de comportamiento).

**Verify**
```sql
-- Correr como el propio script indica en su pie, inmediatamente después:
select * from public.ordenes limit 1;                          -- como coordinador: no debe dar error
select tablename, count(*) from pg_policies where schemaname='public' group by 1 order by 1;
-- expect: perfiles=2 (sel+upd), ingenieros=4, ordenes=3, ordenes_historial=1, piezas_orden=4,
-- inventario=4, movimientos_inventario=2, evidencias=2 — coincide con las políticas que el script crea
```

**Checkpoint**
```bash
# No hay commit de código en este paso — es 100% SQL manual. Se documenta como aplicado:
git add -A && git commit -m "step 4: docs — confirma aplicacion manual de optimizacion RLS" --allow-empty
git tag step-04-rls-optimizado
```

---

#### Paso 5 — Auditoría final

**Do**
Correr la secuencia de salud que ya usa este repo (`README.md`: "Antes de subir cambios") más una
prueba manual dirigida a lo que este blueprint cambió.

**Done when**
- [ ] WHEN corre la secuencia de build completa THE SYSTEM SHALL terminar sin errores ni
      warnings nuevos respecto al estado antes de este blueprint.
- [ ] WHEN se crea una orden manual de prueba con cliente y equipo elegidos THE SYSTEM SHALL
      mostrarla en el tablero con el contrato/cuenta correctos en su detalle.
- [ ] WHEN se importa una WO/SR de prueba (Lexmark o Xerox) THE SYSTEM SHALL comportarse
      exactamente igual que antes de este blueprint — cero regresión en el importador.
- [ ] WHEN se genera el documento PDF de una orden de prueba THE SYSTEM SHALL producirlo
      exactamente igual que antes de este blueprint — cero regresión en la generación de
      documentos.

**Verify**
```bash
npx tsc --noEmit && npm run lint && npm run build
# expect: los tres exit 0, en ese orden — es literalmente el comando que README.md ya pide
# correr antes de subir cambios
```

**Checkpoint**
```bash
git add -A && git commit -m "step 5: auditoria final — cierra deuda de datos (clientes/equipos + RLS)"
git tag step-05-auditoria-final
```

### 9.1 Parity and cutover

**NOT APPLICABLE — no es una migración.** No se reemplaza ningún sistema, framework, base de
datos ni proveedor; es un endurecimiento aditivo sobre el mismo esquema (columnas ya existentes) y
una optimización de políticas con semántica idéntica. No hay corte, no hay coexistencia de dos
rutas, no hay decomiso.

---

## 10. Environment Setup

**Sin variables de entorno nuevas.** Este cambio no agrega ninguna cuenta, servicio ni secreto —
usa las credenciales de Supabase que el proyecto ya tiene configuradas en `.env.local`.

### Prerequisites
| Tool | Version | Check |
|---|---|---|
| Node.js | el que ya usa el repo (24 local / 20.9+ mínimo) | `node -v` |
| npm | el que ya usa el repo | `npm -v` |
| Acceso al SQL editor de Supabase del proyecto `edahyqgfwcitzudvhlqd` | — | necesario solo para el Paso 4 |

### Files that must be committed
`scripts/backfill-clientes.ts` se commitea como referencia histórica del backfill (Paso 2), igual
que cualquier otro script de una-sola-vez del repo — no se agrega a ningún `.gitignore`.

---

## 11. Version Provenance

**No se corrió `stack-researcher` — decisión deliberada, no un salto de proceso.** Este blueprint
no introduce ni actualiza ninguna dependencia: los 5 pasos usan exclusivamente APIs de Supabase JS,
React y Next.js que el repo ya tiene instaladas y en uso (confirmado por `npx tsc --noEmit` limpio
sobre el código actual). Verificar versiones en un registry no aporta nada cuando no hay un pin
nuevo que fijar. Si un paso futuro de este proyecto sí agrega una librería, ese paso debe traer su
propia fila de provenance aquí.

| Layer | Package | Version | Status |
|---|---|---|---|
| — | (ninguna dependencia nueva) | — | N/A |

---

## 12. Release and Rollback

Cada paso es su propio commit + tag (`step-01-…` … `step-05-…`). Si un paso falla o produce un
efecto no deseado:

| Paso | Cómo revertir |
|---|---|
| 1 (selector UI + API) | `git reset --hard step-00` (el tag anterior a este blueprint) o el tag del paso previo — es solo código, sin efecto en datos |
| 2 (backfill) | `update ordenes set cliente_id = null where cliente_id in (<ids que el script reportó como vinculados>)` — el script debe imprimir esa lista para que este rollback sea posible sin adivinar |
| 3 (lectura por FK) | `git reset --hard step-02-backfill-clientes` — los datos del backfill quedan intactos, solo se revierte cómo se leen |
| 4 (RLS) | Guardar como snapshot el `pg_policies` actual **antes** de correr el script (`select * from pg_policies where schemaname='public'` exportado) — revertir es recrear esas políticas exactas si algo se rompe |
| 5 (auditoría) | No aplica — no cambia nada, solo verifica |

No hay downtime en ningún paso — todo es aditivo o de solo-lectura hasta el `UPDATE` del backfill,
que es acotado y reversible como se describe arriba.

---

## 13. Testing Strategy

**El repo no tiene un test runner instalado** (deuda ya documentada en `ARQUITECTURA.md`, fuera de
alcance de este blueprint — ver Non-Goals). La verificación de cada paso es manual + `tsc`/`eslint`/
`build`, como ya lo es el resto del repo hoy. No se introduce Vitest/Jest aquí para no mezclar dos
iniciativas de deuda distintas en un mismo cambio.

---

## 14. Observability

**NOT APPLICABLE** — sin cambios de logging, métricas ni alertas. El único monitoreo relevante es
el conteo de `sin match` que imprime el script del Paso 2, para revisión manual puntual.

---

## 15. Deployment

**Sin cambios al proceso de deploy** (el repo aún no tiene deploy configurado — ver deuda ya
documentada en `ARQUITECTURA.md`, "DESPUÉS — Endurecer"). Este blueprint se aplica sobre el entorno
de desarrollo/producción actual tal como el repo se despliega hoy (manual).

---

## 16. Monitoring & Alerts

**NOT APPLICABLE** — sin servicio nuevo que monitorear.

---

## 17. Third-party Integrations

**NOT APPLICABLE** — no se agrega ninguna integración nueva. Google Docs/Drive y Supabase, ya
integrados, no cambian de configuración.

---

## 18. Recommended Skills for the Builder

Ninguna skill de terceros es necesaria — el cambio es TypeScript/SQL directo sobre patrones que ya
existen en el repo (el propio `SelectorIngenieroSucursal.tsx` es la referencia de estilo para los
selectores nuevos del Paso 1).

---

## 19. Companion Files (modo archivo único — bloques para copiar)

### 19.1 — Nota para `CLAUDE.md` / `AGENTS.md` del proyecto (agregar, no reemplazar)

```markdown
## Convención: cliente_id sobre fuzzy-match

Desde el blueprint "cerrar-deuda-datos": al vincular una orden a un cliente, escribe siempre
`ordenes.cliente_id` (selector en ModalNuevaOrden) en vez de depender del fuzzy-match de
`cuentaDeOrden()`. El fuzzy-match sigue existiendo solo como fallback para órdenes que no tienen
`cliente_id` — no lo uses como camino principal en código nuevo.
```

### 19.6 — Archivos verify-critical

No aplica ningún archivo de configuración de test/e2e — no existe ese runner en el repo (§13).

---

## 20. Decision Log & Final Checklist

### 20.1 — Decisiones tomadas en esta sesión (y por qué)

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| Sacar `sucursal_id` de este blueprint | Incluirlo como Paso 6 | Al investigar se descubrió que toca el flujo de asignación de ingenieros (texto, no FK) en casi todo el repo — mayor blast radius del que el usuario aceptó para "deuda de datos silenciosa" |
| No backfillear `equipo_id`/`contrato_id` | Backfillear con matches parciales | `equipos`/`contratos` están vacíos en producción — no hay nada contra qué emparejar; inventar datos sería peor que dejarlo en `null` |
| `cuentaDeOrden` con parámetro opcional, no una función nueva | Crear `cuentaDeOrdenPorFK()` separada | Un solo punto de verdad para la lógica de fallback; el parámetro opcional deja `/campo` sin tocar por construcción (sigue llamando con 2 argumentos) |
| RLS como paso manual, no automatizado | Intentar aplicarlo por API/CLI | El propio `docs/db-optimizacion-rls.sql` ya documenta que el classifier de la cuenta bloquea `DROP/ALTER POLICY` — es una restricción de la cuenta, no de este blueprint |

### 20.2 — Checklist final (auto-verificado, sin subagente `blueprint-validator` disponible en esta sesión)

- [x] Cero marcadores `[NEEDS CLARIFICATION]` — todo lo ambiguo (sucursal_id, alcance del backfill)
      se resolvió con el usuario antes de escribir este documento.
- [x] Las 20 secciones están presentes, cada una con contenido real o `NOT APPLICABLE — razón`.
- [x] Cada paso de §9 tiene `Do`, `Done when`, `Verify`, `Checkpoint`.
- [x] Ningún `Verify` depende de su propio `Checkpoint` (los `git diff`/`git tag` de verificación
      están en pasos *posteriores* al que los genera, nunca en el mismo).
- [x] Ninguna sección `NOT APPLICABLE` es el origen de un contrato que un paso posterior necesite.
- [x] Cero pines de versión nuevos que verificar (§11 explica por qué).
- [x] Las interfaces congeladas (PDF, captura WO/SR) no aparecen modificadas en ningún paso de §9.

**Auto-auditado por mí (sin subagente `blueprint-validator`, no disponible en esta sesión) — dicho
explícitamente en vez de callado, como exige el proceso.**
