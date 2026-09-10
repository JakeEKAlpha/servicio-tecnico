"use client";

import { useEffect, useRef, useState } from "react";
import { colorOrden, puntoEstatus } from "@/lib/tema";
import { textoEta } from "@/lib/eta";

type IconoProps = { d: string; className?: string };
function Ico({ d, className = "h-4 w-4" }: IconoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

const I = {
  pin: "M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11zM12 10a1 1 0 1 0 0 .01",
  doc: "M6 2h9l5 5v15H6zM15 2v5h5M9 13h6M9 17h6",
  tag: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l6.8 6.8a2 2 0 0 1 0 2.8zM8 8a1 1 0 1 0 0 .01",
  pdf: "M6 2h9l5 5v15H6zM15 2v5h5M9 13h6M9 17h4",
  gen: "M4 4v5h5M20 20v-5h-5M19 9A8 8 0 0 0 5.6 5.6L4 9m16 6-1.6 3.4A8 8 0 0 1 5 15",
  copy: "M9 9h10v10H9zM5 15V5h10",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
  phone:
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.7A2 2 0 0 1 22 16.9z",
  wa: "M4 21l1.6-3.9A8 8 0 1 1 8 20l-4 1zM9 9c-.3 0-.7.1-1 .5s-1 1-1 2 .8 2.3.9 2.5c.2.2 1.7 2.6 4 3.5 2 .8 2.4.6 2.8.6.5 0 1.5-.6 1.7-1.2s.2-1.1.1-1.2l-2-.9c-.2 0-.4-.1-.6.2l-.6.7c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.3 0-.4.1-.5l.5-.6c.1-.2.1-.3 0-.5l-.8-2c-.2-.4-.4-.4-.6-.4z",
  chev: "M6 9l6 6 6-6",
};

export type OrdenFicha = {
  id: string;
  numero_orden: string;
  numero_visita: number | null;
  origen: string | null;
  estatus: string | null;
  marca_nombre: string | null;
  direccion: string | null;
  localidad: string | null;
  estado: string | null;
  tel_movil: string | null;
  link_doc: string | null;
  link_pdf: string | null;
  ingeniero_nombre: string | null;
  fecha_eta: string | null;
  hora_eta: string | null;
};

export default function FichaOrden({
  orden,
  estatus,
  opciones,
  onCambiarEstatus,
  bloqueada,
  onGenerarDoc,
  generandoDoc = false,
  puedeGenerarDoc = false,
}: {
  orden: OrdenFicha;
  estatus: string;
  opciones: readonly string[];
  onCambiarEstatus: (nuevo: string) => void;
  bloqueada: boolean;
  onGenerarDoc?: () => void;
  generandoDoc?: boolean;
  puedeGenerarDoc?: boolean;
}) {
  const c = colorOrden(orden.origen, orden.marca_nombre);
  const [menu, setMenu] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  // Al abrir el menú: enfocar la opción activa (o la primera).
  useEffect(() => {
    if (!menu) return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    const activo = items.findIndex((el) => el.dataset.valor === estatus);
    items[activo >= 0 ? activo : 0]?.focus();
  }, [menu, estatus]);

  function itemsMenu(): HTMLElement[] {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
  }

  function cerrarMenu() {
    setMenu(false);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (bloqueada) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setMenu(true);
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const items = itemsMenu();
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      cerrarMenu();
    }
  }

  async function copiar(txt: string, etiqueta: string) {
    try {
      await navigator.clipboard.writeText(txt);
      setCopiado(etiqueta);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      /* noop */
    }
  }

  const lista = [
    ...(estatus && !opciones.includes(estatus) ? [estatus] : []),
    ...opciones,
  ];

  const dir = [orden.direccion, orden.localidad, orden.estado]
    .filter(Boolean)
    .join(", ");
  const mapsUrl = dir
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dir)}`
    : null;
  const tel = (orden.tel_movil ?? "").replace(/\D/g, "");
  const eta = textoEta(orden.ingeniero_nombre, orden.fecha_eta, orden.hora_eta);

  const btn =
    "inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-semibold backdrop-blur transition-colors hover:bg-white/25";

  return (
    <div
      className={
        "relative overflow-hidden rounded-2xl px-5 py-5 shadow-lg " +
        c.barra +
        " " +
        c.texto
      }
    >
      {/* Degradado sutil + marca de agua */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-black/15" />
      {orden.marca_nombre && (
        <span className="pointer-events-none absolute bottom-1 right-3 select-none text-[4rem] font-black uppercase leading-none tracking-tighter opacity-[0.06]">
          {orden.marca_nombre}
        </span>
      )}

      <div className="relative flex flex-col gap-4">
        {/* Fila superior: estatus (dropdown) + meta */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div ref={ref} className="relative">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => !bloqueada && setMenu((v) => !v)}
              onKeyDown={onTriggerKeyDown}
              className="flex select-none items-center gap-2 rounded-full bg-black/20 py-1.5 pl-2 pr-3 text-sm font-bold shadow-sm ring-1 ring-white/20 transition hover:ring-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-70"
              disabled={bloqueada}
              title="Cambiar estatus"
              aria-haspopup="menu"
              aria-expanded={menu}
            >
              <span
                className={
                  "h-2.5 w-2.5 rounded-full " + puntoEstatus(estatus)
                }
              />
              {estatus}
              {!bloqueada && <Ico d={I.chev} className="h-3.5 w-3.5 opacity-80" />}
            </button>
            {menu && (
              <ul
                ref={menuRef}
                role="menu"
                aria-label="Cambiar estatus"
                onKeyDown={onMenuKeyDown}
                className="absolute left-0 z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-border-default bg-surface py-1 text-sm text-text shadow-2xl"
              >
                {lista.map((s) => (
                  <li key={s} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      data-valor={s}
                      aria-current={s === estatus ? "true" : undefined}
                      onClick={() => {
                        setMenu(false);
                        onCambiarEstatus(s);
                      }}
                      className={
                        "flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none " +
                        (s === estatus ? "font-semibold" : "")
                      }
                    >
                      <span
                        className={"h-2 w-2 rounded-full " + puntoEstatus(s)}
                      />
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ul className="space-y-1 border-l border-white/25 pl-4 text-sm font-semibold">
            <li className="flex items-center gap-2">
              <Ico d={I.pin} className="h-4 w-4 opacity-80" />
              Visita {orden.numero_visita ?? "—"}
            </li>
            {orden.origen && (
              <li className="flex items-center gap-2">
                <Ico d={I.doc} className="h-4 w-4 opacity-80" />
                {orden.origen}
              </li>
            )}
            {orden.marca_nombre && (
              <li className="flex items-center gap-2">
                <Ico d={I.tag} className="h-4 w-4 opacity-80" />
                {orden.marca_nombre}
              </li>
            )}
          </ul>
        </div>

        {/* Número */}
        <div className="flex items-end gap-3">
          <h1 className="text-4xl font-extrabold leading-none tracking-tight tabular-nums sm:text-5xl">
            {orden.numero_orden}
          </h1>
          <button
            type="button"
            onClick={() => copiar(orden.numero_orden, "Número")}
            className="mb-1 rounded-lg p-1.5 opacity-80 transition-colors hover:bg-white/15 hover:opacity-100"
            title="Copiar número"
            aria-label="Copiar número"
          >
            <Ico d={I.copy} />
          </button>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2">
          {orden.link_pdf && (
            <a href={orden.link_pdf} target="_blank" rel="noreferrer" className={btn}>
              <Ico d={I.pdf} className="h-3.5 w-3.5" /> PDF
            </a>
          )}
          {orden.link_doc && (
            <a href={orden.link_doc} target="_blank" rel="noreferrer" className={btn}>
              <Ico d={I.doc} className="h-3.5 w-3.5" /> Doc
            </a>
          )}
          {onGenerarDoc && (
            <button
              type="button"
              onClick={onGenerarDoc}
              disabled={generandoDoc || !puedeGenerarDoc}
              className={btn + " disabled:opacity-50"}
              title={
                puedeGenerarDoc
                  ? undefined
                  : "Falta fecha ETA e ingeniero para generar el documento"
              }
            >
              <Ico d={I.gen} className="h-3.5 w-3.5" />
              {generandoDoc
                ? "Generando…"
                : orden.link_doc
                  ? "Regenerar"
                  : "Generar documento"}
            </button>
          )}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className={btn}>
              <Ico d={I.map} className="h-3.5 w-3.5" /> Mapa
            </a>
          )}
          {tel && (
            <>
              <a href={`tel:${tel}`} className={btn}>
                <Ico d={I.phone} className="h-3.5 w-3.5" /> Llamar
              </a>
              <a
                href={`https://wa.me/${tel.length === 10 ? "52" + tel : tel}`}
                target="_blank"
                rel="noreferrer"
                className={btn}
              >
                <Ico d={I.wa} className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </>
          )}
          {eta && (
            <button
              type="button"
              onClick={() => copiar(eta, "ETA")}
              className={btn}
              title={eta}
            >
              <Ico d={I.copy} className="h-3.5 w-3.5" /> Copiar ETA
            </button>
          )}
          {copiado && (
            <span className="inline-flex items-center rounded-lg bg-black/25 px-2.5 py-1.5 text-xs font-semibold">
              {copiado} copiado
            </span>
          )}
        </div>

        {onGenerarDoc && !puedeGenerarDoc && (
          <p className="text-xs font-medium opacity-80">
            Falta fecha ETA e ingeniero para generar el documento.
          </p>
        )}
      </div>
    </div>
  );
}
