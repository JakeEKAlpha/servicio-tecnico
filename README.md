# Servicio Técnico · Alpha Digital

Sistema web de gestión de órdenes de servicio técnico Lexmark para **Alpha Digital** y
**Baja Digital**. Reemplaza el flujo anterior de Google Sheets + Apps Script.

- **Framework:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript
- **Estilos:** Tailwind CSS v4 (tokens de tema en `app/globals.css`)
- **Backend:** Supabase (Postgres + Auth + Storage + RLS + Realtime).
  La seguridad vive en las políticas RLS; la lógica de negocio en triggers de Postgres.
- **Documentos:** Google Docs/Drive vía cuenta de servicio (genera el Doc + PDF de cada orden).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y rellena los valores (ver abajo)
npm run dev
```

Abre <http://localhost:3000>.

### Variables de entorno

Todas se documentan en [`.env.example`](.env.example):

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexión a Supabase (cliente y servidor) |
| `GOOGLE_SERVICE_ACCOUNT_KEY_B64` | Llave JSON de la cuenta de servicio de Google, en base64 |
| `GOOGLE_IMPERSONATE_USER` | Usuario de Workspace que la cuenta de servicio suplanta |
| `GOOGLE_DOC_TEMPLATE_ID` | Google Doc usado como plantilla de la orden |

## Scripts

| Comando | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build |
| `npm run lint` | ESLint |
| `npm run test` | Pruebas (Vitest) — hoy cubre `lib/**` (parsers, matching, fechas) |

Antes de subir cambios: `npx tsc --noEmit && npm run lint && npm run test && npm run build`.
CI (`.github/workflows/ci.yml`) corre esto mismo en cada PR y en cada push a `main`.

## Estructura

```
app/
  (app)/            vistas autenticadas (tablero, agenda, almacén, gerencia, configuración)
  api/              route handlers (órdenes, piezas, inventario, documentos, gerencia)
  login/  auth/     autenticación (Supabase SSR)
components/          UI (AppShell, tablero, ficha de orden, modales, gráfico Gantt…)
lib/                lógica compartida (supabase, auth, órdenes, piezas, documentos, tema)
docs/               análisis y especificaciones del proceso
proxy.ts            middleware (refresco de sesión de Supabase)
```

## Notas

- El enum `rol_usuario` en la BD usa identificadores en minúscula; las etiquetas
  visibles ("Gerente", "Coordinador"…) salen de `lib/auth/roles.ts`.
- La interfaz es responsive (móvil / tablet / escritorio) y soporta modo claro/oscuro
  (sigue el sistema; se puede forzar desde el menú de usuario).
