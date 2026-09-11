"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseHoraEta, fmtHora } from "@/lib/horas";
import { construirRangoHora } from "@/components/SelectorHora";
import { colorOrden, claseTono } from "@/lib/tema";
import { hoyMx } from "@/lib/fechas";
import { badgeSla } from "@/lib/ordenes/sla";

const HORA_INI = 7;
const HORA_FIN = 20;
const PX_HORA = 72;
const ROW_H = 52;
const LABEL_W = 176;
const HEADER_H = 30;
const HORAS = Array.from(
  { length: HORA_FIN - HORA_INI + 1 },
  (_, i) => HORA_INI + i,
);

export type IngGantt = { id: string; nombre: string; sucursal: string | null };
export type OrdenGantt = {
  id: string;
  numero_orden: string;
  cliente: string | null;
  estatus: string | null;
  origen: string | null;
  marca_nombre: string | null;
  hora_eta: string | null;
  ingeniero_id: string | null;
  horas_sla: number | null;
};

type DragState = {
  ordenId: string;
  origen: "bar" | "chip";
  el: HTMLElement;
  startClientX: number;
  startClientY: number;
  grabX: number; // px desde el borde izq. de la barra al puntero
  durHoras: number; // duración actual de la visita (para conservarla al mover)
  moved: boolean;
};

/** Duración en horas de un `hora_eta`; 1 h si no hay rango. */
function duracionDe(hora: string | null): number {
  const r = parseHoraEta(hora);
  return r?.fin ? Math.max(0.25, r.fin - r.inicio) : 1;
}

export default function GanttDia({
  fecha,
  ingenieros,
  agendadas,
  sinAgendar,
}: {
  fecha: string;
  ingenieros: IngGantt[];
  agendadas: OrdenGantt[];
  sinAgendar: OrdenGantt[];
}) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const resize = useRef<{
    ordenId: string;
    el: HTMLElement;
    startX: number;
    startW: number;
    inicio: number;
  } | null>(null);
  const [filaActiva, setFilaActiva] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Hora actual (México) para la línea de "ahora" — solo si se ve hoy.
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    function tick() {
      if (fecha !== hoyMx()) {
        setAhora(null);
        return;
      }
      const p = new Intl.DateTimeFormat("es-MX", {
        timeZone: "America/Mexico_City",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      const h =
        Number(p.find((x) => x.type === "hour")?.value ?? 0) +
        Number(p.find((x) => x.type === "minute")?.value ?? 0) / 60;
      setAhora(h >= HORA_INI && h <= HORA_FIN ? h : null);
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [fecha]);

  const anchoGrid = LABEL_W + HORAS.length * PX_HORA;
  const altoGrid = HEADER_H + Math.max(1, ingenieros.length) * ROW_H;

  function nav(nuevaFecha: string) {
    router.push(`/tablero-dias?fecha=${nuevaFecha}`);
  }

  function filaDesdeY(clientY: number): number {
    const g = gridRef.current?.getBoundingClientRect();
    if (!g) return -1;
    return Math.floor((clientY - g.top - HEADER_H) / ROW_H);
  }

  function onDown(
    e: React.PointerEvent<HTMLElement>,
    ordenId: string,
    origen: "bar" | "chip",
    horaEta: string | null,
  ) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    drag.current = {
      ordenId,
      origen,
      el,
      startClientX: e.clientX,
      startClientY: e.clientY,
      grabX: origen === "bar" ? e.clientX - rect.left : 24,
      durHoras: origen === "bar" ? duracionDe(horaEta) : 1,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
    el.style.transition = "none";
    el.style.zIndex = "40";
  }

  // --- Redimensionar la barra (borde derecho) para alargar/acortar la visita ---
  function onResizeDown(
    e: React.PointerEvent<HTMLElement>,
    ordenId: string,
    horaEta: string | null,
  ) {
    e.stopPropagation();
    const el = e.currentTarget.parentElement as HTMLElement;
    const r = parseHoraEta(horaEta);
    resize.current = {
      ordenId,
      el,
      startX: e.clientX,
      startW: el.getBoundingClientRect().width,
      inicio: r?.inicio ?? 9,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    el.style.transition = "none";
    el.style.zIndex = "40";
  }

  function anchoAHoras(px: number): number {
    // px -> horas, redondeado a cuartos, mínimo 15 min.
    return Math.max(0.25, Math.round((px / PX_HORA) * 4) / 4);
  }

  function onMove(e: React.PointerEvent) {
    const rz = resize.current;
    if (rz) {
      const w = Math.max(
        PX_HORA * 0.25,
        Math.min(
          rz.startW + (e.clientX - rz.startX),
          (HORA_FIN - rz.inicio) * PX_HORA,
        ),
      );
      rz.el.style.width = `${w}px`;
      return;
    }

    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startClientX;
    const dy = e.clientY - d.startClientY;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    // Movimiento directo por DOM — sin re-render de React.
    d.el.style.transform = `translate(${dx}px, ${dy}px)`;
    d.el.style.opacity = "0.9";
    const fila = filaDesdeY(e.clientY);
    const nueva = fila >= 0 && fila < ingenieros.length ? fila : null;
    // Solo re-render cuando de verdad cambia la fila resaltada.
    setFilaActiva((prev) => (prev === nueva ? prev : nueva));
  }

  async function onUp(e: React.PointerEvent) {
    // --- fin de redimensionar ---
    const rz = resize.current;
    resize.current = null;
    if (rz) {
      rz.el.style.transition = "";
      rz.el.style.zIndex = "";
      const dur = anchoAHoras(rz.el.getBoundingClientRect().width);
      const fin = Math.min(rz.inicio + dur, HORA_FIN);
      const nuevoRango = construirRangoHora(fmtHora(rz.inicio), fmtHora(fin));
      setMsg("Guardando…");
      try {
        const r = await fetch(`/api/ordenes/${rz.ordenId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hora_eta: nuevoRango, regenerar_doc: false }),
        });
        const data = await r.json();
        setMsg(data.ok ? null : (data.error ?? "No se pudo cambiar la duración."));
        if (data.ok) router.refresh();
      } catch {
        setMsg("Error de red.");
      }
      return;
    }

    const d = drag.current;
    drag.current = null;
    setFilaActiva(null);
    if (!d) return;

    d.el.style.transform = "";
    d.el.style.opacity = "";
    d.el.style.zIndex = "";
    d.el.style.transition = "";

    if (!d.moved) {
      // fue un clic: abrir el detalle
      if (d.origen === "bar") router.push(`/tablero/${d.ordenId}`);
      return;
    }

    const g = gridRef.current!.getBoundingClientRect();
    const fila = Math.floor((e.clientY - g.top - HEADER_H) / ROW_H);
    const ing = ingenieros[fila];
    if (!ing || fila < 0) return;

    let hora = HORA_INI + (e.clientX - g.left - LABEL_W - d.grabX) / PX_HORA;
    hora = Math.round(hora * 4) / 4;
    hora = Math.max(HORA_INI, Math.min(HORA_FIN - 0.5, hora));

    // Al agendar desde "Sin agendar" (chip), el PATCH genera el Doc + PDF de
    // verdad antes de responder (llamadas reales a Google) — eso tarda unos
    // segundos. "Guardando…" a secas se siente como que se congeló; avisar
    // qué está pasando no cambia nada de cómo/cuándo se genera el documento.
    const generaDoc = d.origen === "chip";
    setMsg(generaDoc ? "Generando documento…" : "Guardando…");
    try {
      const r = await fetch(`/api/ordenes/${d.ordenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_eta: fecha,
          hora_eta: construirRangoHora(
            fmtHora(hora),
            fmtHora(Math.min(hora + d.durHoras, HORA_FIN)),
          ),
          ingeniero_id: ing.id,
          regenerar_doc: generaDoc,
        }),
      });
      const data = await r.json();
      setMsg(data.ok ? null : (data.error ?? "No se pudo mover."));
      if (data.ok) router.refresh();
    } catch {
      setMsg("Error de red.");
    }
  }

  return (
    <div className="space-y-3" onPointerMove={onMove} onPointerUp={onUp}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">
          Fecha{" "}
          <input
            type="date"
            defaultValue={fecha}
            onChange={(e) => nav(e.target.value)}
            className="rounded-lg border border-border-default bg-surface px-2 py-1 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </label>
        {msg && <span className="text-sm text-muted">{msg}</span>}
        {/* Leyenda de color por tipo */}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-marca-lexmark" /> WO
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-marca-lexmark-sr" /> SR /
            proactiva
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-marca-xerox" /> Xerox
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-marca-alpha" /> Alpha
          </span>
        </div>
      </div>

      {/* Sin agendar — tira horizontal arriba de la cuadrícula (wireframe
          11h): antes era un riel vertical que se comía ancho útil. */}
      <div>
        <h2 className="mb-1.5 text-sm font-bold">
          Sin agendar{" "}
          <span className="font-normal text-muted">({sinAgendar.length})</span>
        </h2>
        {sinAgendar.length === 0 ? (
          <p className="text-xs text-muted">Nada pendiente.</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted">
              Arrastra una tarjeta a la cuadrícula para agendarla.
            </p>
            <ul className="scroll-oculto flex gap-2 overflow-x-auto pb-1">
              {sinAgendar.map((o) => {
                const c = colorOrden(o.origen, o.marca_nombre);
                const sla = badgeSla(o.horas_sla);
                return (
                  <li
                    key={o.id}
                    onPointerDown={(e) => onDown(e, o.id, "chip", o.hora_eta)}
                    className="w-40 shrink-0 cursor-grab touch-none rounded-lg border border-border-default bg-surface p-2 text-xs shadow-sm transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-1.5 truncate font-semibold">
                      <span className={"h-2 w-2 shrink-0 rounded-full " + c.punto} />
                      {o.numero_orden}
                    </div>
                    <div className="truncate text-muted">{o.cliente}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span
                        className={
                          "inline-block rounded px-1.5 py-0.5 font-medium " +
                          c.barra +
                          " " +
                          c.texto
                        }
                      >
                        {o.origen === "SR" ? "SR" : "WO"} · {o.estatus}
                      </span>
                      {sla && (
                        <span
                          className={
                            "inline-block rounded px-1.5 py-0.5 font-bold " +
                            claseTono(sla.tono)
                          }
                        >
                          {sla.texto}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="scroll-oculto overflow-auto rounded-xl border border-border-default shadow-sm">
        <div
          ref={gridRef}
            className="relative touch-none select-none bg-surface text-xs"
            style={{ width: anchoGrid, height: altoGrid }}
          >
            {/* Header horas */}
            <div
              className="pointer-events-none absolute left-0 top-0 border-b border-border-default bg-surface-2"
              style={{ height: HEADER_H, width: anchoGrid }}
            >
              {HORAS.map((h, i) => (
                <div
                  key={h}
                  className="absolute top-0 flex h-full items-center justify-center border-l border-border-default/60 font-medium text-muted"
                  style={{ left: LABEL_W + i * PX_HORA, width: PX_HORA }}
                >
                  {String(h).padStart(2, "0")}h
                </div>
              ))}
            </div>

            {/* Filas */}
            {ingenieros.map((ing, idx) => (
              <div
                key={ing.id}
                className={
                  "absolute border-b border-border-default/70 " +
                  (filaActiva === idx ? "bg-brand-050" : "")
                }
                style={{
                  top: HEADER_H + idx * ROW_H,
                  height: ROW_H,
                  width: anchoGrid,
                }}
              >
                <div
                  className="absolute left-0 top-0 flex h-full flex-col justify-center border-r border-border-default bg-surface px-3"
                  style={{ width: LABEL_W }}
                >
                  <span className="truncate font-semibold">{ing.nombre}</span>
                  {ing.sucursal && (
                    <span className="truncate text-[10px] text-muted">
                      {ing.sucursal}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Líneas verticales */}
            {HORAS.map((h, i) => (
              <div
                key={"v" + h}
                className="pointer-events-none absolute border-l border-border-default/50"
                style={{
                  left: LABEL_W + i * PX_HORA,
                  top: HEADER_H,
                  height: Math.max(1, ingenieros.length) * ROW_H,
                }}
              />
            ))}

            {/* Línea de "ahora" (solo si se ve el día de hoy) */}
            {ahora != null && (
              <div
                className="pointer-events-none absolute z-20 w-0.5 bg-red"
                style={{
                  left: LABEL_W + (ahora - HORA_INI) * PX_HORA,
                  top: HEADER_H - 4,
                  height: Math.max(1, ingenieros.length) * ROW_H + 4,
                }}
              >
                <span className="absolute -top-4 -left-3 rounded bg-red px-1 text-[10px] font-bold text-white">
                  {fmtHora(ahora)}
                </span>
              </div>
            )}

            {/* Barras */}
            {agendadas.map((o) => {
              const idx = ingenieros.findIndex((i) => i.id === o.ingeniero_id);
              if (idx < 0) return null;
              const r = parseHoraEta(o.hora_eta);
              const inicio = r?.inicio ?? 9;
              const dur = r?.fin ? r.fin - r.inicio : 1;
              const c = colorOrden(o.origen, o.marca_nombre);
              return (
                <div
                  key={o.id}
                  onPointerDown={(e) => onDown(e, o.id, "bar", o.hora_eta)}
                  title={`${o.numero_orden} · ${o.cliente ?? ""}\n${o.origen ?? ""} · ${o.estatus ?? ""}\n${o.hora_eta ?? ""}`}
                  className={
                    "group absolute flex cursor-grab touch-none items-center overflow-hidden rounded-md px-2 shadow-sm ring-1 ring-black/10 transition-shadow hover:shadow-md active:cursor-grabbing " +
                    c.barra +
                    " " +
                    c.texto
                  }
                  style={{
                    left: LABEL_W + (inicio - HORA_INI) * PX_HORA,
                    top: HEADER_H + idx * ROW_H + 7,
                    width: Math.max(PX_HORA * dur, 44),
                    height: ROW_H - 14,
                  }}
                >
                  <span className="truncate text-[11px] font-semibold">
                    {o.numero_orden} · {o.cliente}
                  </span>
                  {/* Tirador para alargar/acortar la visita */}
                  <span
                    onPointerDown={(e) => onResizeDown(e, o.id, o.hora_eta)}
                    title="Arrastra para cambiar la duración"
                    className="absolute right-0 top-0 h-full w-2.5 cursor-ew-resize touch-none bg-black/10 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
