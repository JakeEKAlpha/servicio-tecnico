# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Coordinador** (uno por zona) — arma y ajusta la asignación diaria de órdenes de servicio a
  ingenieros de su zona. Vive en el Tablero y el Gantt (`/tablero-dias`) horas seguidas.
- **Gerencia / Admin** — visibilidad total (todas las zonas y las dos empresas), catálogos
  maestros (`/gerencia`), analítica de cumplimiento de SLA (`/gerencia/reportes`).
- **Ingeniero de campo** — recibe la asignación y documenta la visita (checklist, evidencia
  fotográfica, dictado de voz) desde `/campo`, exclusivamente en su celular.
- **Encargado de almacén** — gestiona inventario de piezas por sucursal, confirma arribos.

## Product Purpose

Digitaliza el flujo completo de servicio técnico de Alpha Digital / Baja Digital: captura de
órdenes (WO/SR de Lexmark, reportes de Xerox, servicios propios), asignación a ingenieros por
zona/sucursal, seguimiento de SLA, documentación de la visita (checklist + evidencia +
generación de documento/PDF), inventario de piezas, y análisis de cumplimiento para gerencia.
Reemplaza un sistema anterior en Google Sheets + Apps Script.

## Positioning

Alpha Digital / Baja Digital son socio de servicio **autorizado** de Lexmark y Xerox — no un
taller genérico — y además atienden otras marcas (HP) y contratos propios (renta, garantía,
póliza, TyM), operando como dos empresas con sucursales en el sureste de México y Baja
California. Tono del rediseño (decisión delegada por el usuario): equilibrar la seriedad de un
socio técnico autorizado y confiable con la frescura de un producto SaaS moderno — ni tan
corporativo que se sienta anticuado frente a Lexmark/Xerox, ni tan lúdico que reste seriedad.

## Operating Context

- Coordinación y gerencia trabajan de escritorio/laptop en oficina (Tablero, Gantt, Reportes,
  Gerencia) — sesiones largas, mismo usuario todo el día.
- Los ingenieros de campo usan **solo el celular** (PWA instalable, service worker + push),
  casi siempre en exteriores: **sol directo** (bajo contraste real del panel se pierde), **una
  mano ocupada** con herramienta/equipo, **a veces con guantes**, y con **conexión de datos
  inestable** (zonas rurales o interior de instalaciones del cliente).
- Almacén trabaja desde tablet o escritorio en su sucursal.
- RLS real en Supabase por rol: coordinador ve solo su zona; gerencia/admin ve todo; ingeniero
  ve/actualiza únicamente sus propias órdenes vía `/campo`; almacén ve su sucursal.

## Capabilities and Constraints

- Multimarca: Lexmark y Xerox son partners oficiales (`marcas.es_partner = true`); HP y otras
  marcas se atienden sin ser partner.
- Multiempresa: Alpha Digital y Baja Digital (`empresas`), cada una con sus sucursales.
- SLA real de Lexmark ya modelado: WO usa el "Customer Committed Completion Date" del propio
  reporte; SR usa un límite interno fijo de 22 días naturales desde creación
  (`lib/ordenes/sla.ts`, reusado en `/gerencia/reportes`).
- Web Push real (PWA) para ingenieros — Fase 1 en producción (nueva asignación, pieza
  disponible); Fase 2 (9 disparadores programados + resumen diario) pendiente de credencial.
- **Congelado — regla de negocio, no de UI:** la lógica de generación de documento/PDF (Google
  Docs) y el formato exacto de captura de WO/SR de Lexmark nunca se tocan sin autorización
  explícita aparte. Este rediseño puede tocar layout, estilo y motion de cualquier pantalla,
  incluido `/campo`, pero no esa lógica ni ese formato.
- Sistema muy nuevo en producción (creado 2026-09-09): el volumen real de datos hoy es bajo —
  el diseño debe sostenerse igual de bien en estados con pocos datos que a futuro con volumen alto.
- Terminología: "orden" (unidad de trabajo), "WO"/"SR" (Lexmark), "visita"/"reporte de tarea"
  (Xerox), "sucursal", "zona", "cuenta"/"cliente", "pieza".

## Brand Commitments

- Nombre: "Servicio Técnico" (Alpha Digital / Baja Digital).
- Colores ya establecidos (`lib/tema.ts`, `colorOrden`): azul Alpha `#203F7E` (marca, dominante),
  rojo Alpha (acento), verde Lexmark (WO), ámbar Lexmark (SR/proactiva), rojo Xerox.
- Tipografía: Montserrat.
- Logo: `public/logo-alpha.svg`.
- Sistema de tokens de UI ya en uso con disciplina (`lib/ui.ts`: `campo`, `boton`, `tarjeta`,
  `chip`, `encabezadoSeccion`, …) — es autoridad visual incumbente, no un borrador a descartar.
- Libertad creativa total dentro de esta identidad — el usuario no fijó ninguna referencia
  visual externa obligatoria (decisión explícita).

## Evidence on Hand

- Repositorio funcionando en producción (Next.js 16 + Supabase), desplegado en Vercel.
- `ARQUITECTURA.md` documenta cada módulo, decisión y regla de negocio — mantenerlo actualizado
  es parte del flujo de trabajo del proyecto.
- Dashboard de referencia del propio usuario (evidencia de su gusto en analítica: Montserrat,
  verde Lexmark/azul Alpha, tarjetas KPI compactas, denso pero limpio) — ya usado para construir
  `/gerencia/reportes`.
- Producción real verificable vía Supabase (proyecto `edahyqgfwcitzudvhlqd`) y navegador — validar
  siempre contra datos reales, nunca inventar contenido de muestra que aparente ser real.

## Product Principles

1. **Cohesión de marca ante todo** — oficina y campo deben sentirse el mismo producto, nunca un
   mosaico de estilos.
2. **El campo manda en `/campo`** — bajo sol, con una mano, a veces con guantes, con conexión
   inestable: legibilidad y targets de toque grandes ganan sobre densidad de información.
3. **Denso pero nunca abrumador en oficina** — coordinación/gerencia viven horas en
   Tablero/Gantt/Reportes; prioridad al escaneo rápido sobre la decoración.
4. **Nunca tocar lo congelado** — PDF/Doc y formato de captura WO/SR quedan intactos; frescura y
   personalización viven en la capa de presentación, no en la lógica de negocio.
5. **Real por encima de bonito** — cualquier estado, gráfica o dato mostrado refleja datos reales
   de producción (o un estado vacío honesto), nunca un placeholder que aparente ser real.

## Accessibility & Inclusion

- `/campo`: alto contraste obligatorio (uso bajo sol directo), targets de toque grandes (uso con
  guantes / una mano), estados de carga y reintento explícitos (conexión inestable).
- Sin estándar WCAG específico exigido por el negocio — aplicar buenas prácticas por defecto
  (contraste AA, targets ≥44px, foco visible — ya presente en `lib/ui.ts`).
