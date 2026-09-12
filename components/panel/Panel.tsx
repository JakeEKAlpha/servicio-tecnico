"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import type { DatosPanel } from "@/lib/panel/datos";
import {
  agregarWidget,
  quitarWidget,
  redimensionar,
  layoutPorDefecto,
  BREAKPOINTS,
  COLS,
  type PanelLayout,
} from "@/lib/panel/layout";
import { widgetDef, widgetsDeRol, rolPuedeVer } from "@/lib/panel/catalogo";
import WidgetShell from "@/components/panel/WidgetShell";
import { Config } from "@/lib/iconos";
import ToggleVista from "@/components/panel/ToggleVista";
import {
  KpiNumero,
  KpiMedidor,
  ListaPendientes,
  AgendaHoy,
  AlertasCriticas,
  NecesitaAtencion,
  RelojesZona,
  AccesosRapidos,
  FiltrosRapidos,
} from "@/components/panel/widgets/basicos";
import GraficoFlujo from "@/components/panel/widgets/GraficoFlujo";
import GraficoFases from "@/components/panel/widgets/GraficoFases";

const Grid = WidthProvider(Responsive);
const FILA = 56;
const MARGEN = 16;

type Bp = "lg" | "md" | "sm";

export default function Panel({
  datos,
  rol,
  contexto,
  nombre,
  layoutInicial,
}: {
  datos: DatosPanel;
  rol: string;
  contexto: string;
  nombre: string;
  layoutInicial: PanelLayout;
}) {
  const [layout, setLayout] = useState<PanelLayout>(layoutInicial);
  const [editando, setEditando] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bp, setBp] = useState<Bp>("lg");
  const [montado, setMontado] = useState(false);
  const snapshot = useRef<PanelLayout>(layoutInicial);

  useEffect(() => {
    // react-grid-layout necesita `window`; hasta aquí se pinta un fallback
    // estático (sin CLS ni riesgo en SSR). Ya montado, `onBreakpointChange`
    // ajusta `bp` al ancho real y a los cambios de tamaño de ventana.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMontado(true);
  }, []);

  const editable = bp !== "sm";

  const kpi = (etiqueta: string) =>
    datos.base.kpis.find((k) => k.etiqueta === etiqueta);

  function contenido(id: string): React.ReactNode {
    switch (id) {
      case "filtros":
        return <FiltrosRapidos kpis={datos.base.kpis} />;
      case "alertas":
        return <AlertasCriticas alertas={datos.alertas} />;
      case "atencion":
        return <NecesitaAtencion items={datos.atencion} />;
      case "kpi_activas":
        return <KpiNumero kpi={kpi("Órdenes activas")} />;
      case "kpi_sin_asignar":
        return <KpiNumero kpi={kpi("Sin asignar")} />;
      case "kpi_hoy":
        return <KpiNumero kpi={kpi("Para hoy")} />;
      case "kpi_eta":
        return <KpiMedidor pct={datos.cumplimientoEta} />;
      case "flujo":
        return <GraficoFlujo datos={datos.flujo} />;
      case "fases":
        return <GraficoFases datos={datos.fases} />;
      case "pendientes":
        return (
          <ListaPendientes
            titulo={datos.base.pendientesTitulo}
            items={datos.base.pendientes}
          />
        );
      case "agenda":
        return <AgendaHoy filas={datos.base.agendaHoy} />;
      case "relojes":
        return <RelojesZona />;
      case "accesos":
        return <AccesosRapidos accesos={datos.base.accesos} />;
      case "alm_validar":
        return <KpiNumero kpi={kpi("Piezas por validar")} />;
      case "alm_minimo":
        return <KpiNumero kpi={kpi("Bajo mínimo")} />;
      case "alm_arribos":
        return <KpiNumero kpi={kpi("Arribos pendientes")} />;
      default:
        return null;
    }
  }

  const idsVisibles = useMemo(
    () =>
      layout.lg
        .map((it) => it.i)
        .filter((i) => {
          const d = widgetDef(i);
          if (!d || layout.ocultos.includes(i) || !rolPuedeVer(i, rol)) return false;
          // Widgets "solo escritorio" (ej. varios relojes uno junto al otro)
          // no se encogen en móvil, se quitan del todo — si no, dejarían un
          // hueco vacío en el acomodo de la rejilla.
          if (d.soloEscritorio && bp === "sm") return false;
          return true;
        }),
    [layout, rol, bp],
  );

  const layouts = useMemo(() => {
    const arma = (
      arr: { i: string; x: number; y: number; w: number; h: number }[],
      cols: number,
    ): Layout[] =>
      idsVisibles.map((i) => {
        const d = widgetDef(i)!;
        const it =
          arr.find((x) => x.i === i) ??
          layout.lg.find((x) => x.i === i) ?? { i, x: 0, y: 999, w: d.def.w, h: d.def.h };
        const minW = Math.min(d.min.w, cols);
        const w = Math.min(Math.max(it.w, minW), cols);
        return {
          i,
          x: Math.max(0, Math.min(it.x, cols - w)),
          y: it.y,
          w,
          h: Math.max(it.h, d.min.h),
          minW,
          minH: d.min.h,
          maxW: cols,
        };
      });
    return {
      lg: arma(layout.lg, COLS.lg),
      md: arma(layout.md, COLS.md),
      sm: arma(layout.sm, COLS.sm),
    };
  }, [idsVisibles, layout]);

  const disponibles = widgetsDeRol(rol).filter((w) => !idsVisibles.includes(w.id));

  const alturaMin = useMemo(() => {
    const filas = layout.lg
      .filter((it) => idsVisibles.includes(it.i))
      .reduce((m, it) => Math.max(m, it.y + it.h), 0);
    return filas * (FILA + MARGEN);
  }, [layout, idsVisibles]);

  /* ---------- edición ---------- */

  function abrirEdicion() {
    snapshot.current = layout;
    setEditando(true);
    setError(null);
  }

  function cancelar() {
    setLayout(snapshot.current);
    setEditando(false);
    setSucio(false);
    setError(null);
  }

  function restablecer() {
    setLayout(layoutPorDefecto(rol));
    setSucio(true);
  }

  /**
   * Captura el layout del breakpoint activo tras un arrastre/redimensión del
   * usuario. NO se usa `onLayoutChange` porque también dispara cuando cambiamos
   * el layout por menú, y RGL a veces devuelve el estado anterior — pisaría el
   * cambio programático.
   */
  function capturarBp(actual: Layout[]) {
    const limpio = actual.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h }));
    setLayout((prev) => ({ ...prev, [bp]: limpio }));
    setSucio(true);
  }

  function tamano(id: string, t: "s" | "m" | "l") {
    const d = widgetDef(id);
    if (!d) return;
    const w = t === "s" ? d.min.w : t === "l" ? Math.max(d.def.w, d.min.w + 3) : d.def.w;
    const h = t === "s" ? d.min.h : t === "l" ? d.def.h + 1 : d.def.h;
    setLayout((prev) => redimensionar(prev, id, w, h));
    setSucio(true);
  }

  function quitar(id: string) {
    setLayout((prev) => quitarWidget(prev, id));
    setSucio(true);
  }

  function agregar(id: string) {
    setLayout((prev) => agregarWidget(prev, id));
    setSucio(true);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch("/api/preferencias", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clave: "panel_layout", valor: layout }),
      });
      if (!r.ok) throw new Error();
      setSucio(false);
      setEditando(false);
    } catch {
      setError("No se pudo guardar. Reintenta.");
    } finally {
      setGuardando(false);
    }
  }

  /* ---------- render ---------- */

  return (
    <div className="w-full p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-brand">
            Hola, {nombre.split(/\s+/)[0]}
          </h1>
          <p className="truncate text-sm text-muted">{contexto}</p>
        </div>

        <ToggleVista actual="panel" />

        {editable &&
          (editando ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={restablecer}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-muted hover:bg-surface-2 hover:text-text"
              >
                Restablecer
              </button>
              <button
                type="button"
                onClick={cancelar}
                className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-bold text-text hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando || !sucio}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-brand-fg hover:bg-brand-600 disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={abrirEdicion}
              className="flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-bold text-text hover:bg-surface-2"
            >
              <Config className="h-3.5 w-3.5" />
              Personalizar
            </button>
          ))}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-tone-rojo-bg px-3 py-2 text-xs font-semibold text-tone-rojo-fg">
          {error}
        </p>
      )}

      {editando && disponibles.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border-default bg-surface-2/50 p-3">
          <span className="text-xs font-bold text-muted">Agregar:</span>
          {disponibles.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => agregar(w.id)}
              className="rounded-full border border-border-default bg-surface px-2.5 py-1 text-xs font-semibold text-text hover:border-brand/40 hover:text-brand"
            >
              + {w.titulo}
            </button>
          ))}
        </div>
      )}

      {!montado ? (
        <div
          className="grid grid-cols-1 gap-4 lg:grid-cols-12"
          style={{ minHeight: alturaMin || undefined }}
        >
          {[...idsVisibles]
            .sort((a, b) => {
              const ia = layout.lg.find((x) => x.i === a);
              const ib = layout.lg.find((x) => x.i === b);
              return (ia?.y ?? 0) - (ib?.y ?? 0) || (ia?.x ?? 0) - (ib?.x ?? 0);
            })
            .map((id) => {
              const it = layout.lg.find((x) => x.i === id);
              const span = Math.min(Math.max(it?.w ?? 6, 1), 12);
              const h = (it?.h ?? 2) * (FILA + MARGEN) - MARGEN;
              return (
                <div
                  key={id}
                  style={{ gridColumn: `span ${span} / span ${span}`, height: h }}
                >
                  <WidgetShell
                    titulo={widgetDef(id)!.titulo}
                    editando={false}
                    onQuitar={() => undefined}
                    onTamano={() => undefined}
                  >
                    {contenido(id)}
                  </WidgetShell>
                </div>
              );
            })}
        </div>
      ) : (
        <div
          className={editando ? "panel-editando" : undefined}
          style={{ minHeight: alturaMin || undefined }}
        >
          <Grid
            className="layout"
            layouts={layouts}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={FILA}
            margin={[MARGEN, MARGEN]}
            containerPadding={[0, 0]}
            isDraggable={editando && editable}
            isResizable={editando && editable}
            draggableHandle=".arrastrar"
            onBreakpointChange={(nuevo) => setBp(nuevo as Bp)}
            onDragStop={(l) => capturarBp(l)}
            onResizeStop={(l) => capturarBp(l)}
          >
            {idsVisibles.map((id) => (
              <div key={id}>
                <WidgetShell
                  titulo={widgetDef(id)!.titulo}
                  editando={editando && editable}
                  onQuitar={() => quitar(id)}
                  onTamano={(t) => tamano(id, t)}
                >
                  {contenido(id)}
                </WidgetShell>
              </div>
            ))}
          </Grid>
        </div>
      )}
    </div>
  );
}
