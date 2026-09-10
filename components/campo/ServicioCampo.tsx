"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrdenCampo } from "@/lib/campo/ordenes";
import type { Evidencia } from "@/lib/campo/evidencias";
import type { PiezaOrden } from "@/lib/piezas";
import {
  CHECKLIST_CAMPO,
  normalizarChecklist,
  type ChecklistCampo,
} from "@/lib/campo/checklist";
import GrupoEvidencia from "@/components/campo/GrupoEvidencia";
import PiezasCampo from "@/components/campo/PiezasCampo";
import DictadoVoz from "@/components/campo/DictadoVoz";

const VERDE = "#00A859";
const VERDE_OSC = "#004B25";

function Tarjeta({
  titulo,
  children,
}: {
  titulo?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-3xl border border-border-default bg-surface p-4 shadow-sm">
      {titulo && (
        <h3 className="text-[11px] font-black uppercase tracking-widest text-[#004B25]">
          {titulo}
        </h3>
      )}
      {children}
    </section>
  );
}

export default function ServicioCampo({
  orden,
  evidencias,
  piezas,
}: {
  orden: OrdenCampo;
  evidencias: Evidencia[];
  piezas: PiezaOrden[];
}) {
  const router = useRouter();

  const iniciado = !!orden.hora_inicio_real;
  const osGenerada = !!orden.hora_fin_real;
  const cerrada = orden.estatus === "Concluido" || orden.estatus === "Cancelado";

  const [checklist, setChecklist] = useState<ChecklistCampo>(
    normalizarChecklist(orden.checklist),
  );
  const [mono, setMono] = useState(orden.contador_mono?.toString() ?? "");
  const [color, setColor] = useState(orden.contador_color?.toString() ?? "");
  const [diag, setDiag] = useState(orden.diagnostico_campo ?? "");
  const [estatusFinal, setEstatusFinal] = useState<"Concluido" | "Pendiente">(
    "Concluido",
  );

  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null,
  );
  const [ocupado, setOcupado] = useState(false);

  const dir = [orden.direccion, orden.localidad, orden.estado]
    .filter(Boolean)
    .join(", ");
  const tel = (orden.tel_movil ?? "").replace(/\D/g, "");

  async function llamar(url: string, body: unknown, exito: string) {
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch(url, {
        method: body && (body as { _method?: string })._method === "PATCH" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setMsg({ tipo: "error", texto: data.error ?? "Algo falló." });
        return null;
      }
      setMsg({ tipo: "ok", texto: data.aviso ? `${exito} (${data.aviso})` : exito });
      router.refresh();
      return data;
    } catch {
      setMsg({ tipo: "error", texto: "Error de red." });
      return null;
    } finally {
      setOcupado(false);
    }
  }

  function guardarAvance(patch: Record<string, unknown>) {
    return llamar(
      `/api/campo/${orden.id}`,
      { _method: "PATCH", ...patch },
      "Guardado.",
    );
  }

  async function iniciarServicio() {
    setOcupado(true);
    setMsg(null);
    const pedirGps = () =>
      new Promise<{ lat?: number; lng?: number }>((resolve) => {
        if (!navigator.geolocation) return resolve({});
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve({}),
          { enableHighAccuracy: true, timeout: 8000 },
        );
      });
    const gps = await pedirGps();
    setOcupado(false);
    await llamar(
      `/api/campo/${orden.id}`,
      { accion: "iniciar", ...gps },
      "Servicio iniciado.",
    );
  }

  async function generarOs() {
    // Guarda el último estado de los campos antes de generar.
    await guardarAvance({
      checklist,
      contador_mono: mono,
      contador_color: color,
      diagnostico_campo: diag,
    });
    await llamar(
      `/api/campo/${orden.id}`,
      { accion: "generar_os", estatus_final: estatusFinal },
      "Orden de servicio generada.",
    );
  }

  async function cerrar() {
    await llamar(
      `/api/campo/${orden.id}`,
      { accion: "cerrar", estatus_final: estatusFinal },
      "Ticket cerrado.",
    );
  }

  const btnPrim =
    "w-full rounded-2xl py-4 text-sm font-black text-white shadow-lg transition-transform active:scale-[0.99] disabled:opacity-50";

  return (
    <div className="space-y-4">
      {/* Ficha inalterable */}
      <div
        className="rounded-3xl p-4 text-white shadow-lg"
        style={{ background: `linear-gradient(150deg, ${VERDE_OSC}, #002d16)` }}
      >
        <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-emerald-200">
          <span>Ficha de servicio</span>
          <span>
            {orden.numero_orden} · v{orden.numero_visita ?? 1}
          </span>
        </div>
        <p className="text-lg font-extrabold leading-tight">{orden.cliente}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div className="col-span-2">
            <dt className="text-emerald-300">Equipo</dt>
            <dd className="font-semibold">
              {[orden.modelo, orden.serie].filter(Boolean).join(" · ") || "—"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-emerald-300">Reporte</dt>
            <dd className="font-medium text-emerald-50">{orden.falla ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-emerald-300">ETA</dt>
            <dd className="font-semibold">{orden.hora_eta ?? orden.fecha_eta ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-emerald-300">Contacto</dt>
            <dd className="font-semibold">{orden.contacto ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-emerald-300">Domicilio</dt>
            <dd className="font-medium">{dir || "—"}</dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          {dir && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dir)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur"
            >
              Mapa
            </a>
          )}
          {tel && (
            <>
              <a
                href={`tel:${tel}`}
                className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur"
              >
                Llamar
              </a>
              <a
                href={`https://wa.me/${tel.length === 10 ? "52" + tel : tel}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur"
              >
                WhatsApp
              </a>
            </>
          )}
          {orden.link_pdf && (
            <a
              href={orden.link_pdf}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur"
            >
              PDF
            </a>
          )}
        </div>
      </div>

      {msg && (
        <p
          role="status"
          aria-live="polite"
          className={
            "rounded-xl px-3 py-2 text-sm font-semibold " +
            (msg.tipo === "ok"
              ? "bg-[#00A859]/10 text-[#004B25]"
              : "bg-danger/10 text-danger")
          }
        >
          {msg.texto}
        </p>
      )}

      {/* Tiempos */}
      {iniciado && (
        <div className="flex items-center justify-between rounded-2xl border border-[#00A859]/30 bg-[#00A859]/10 px-4 py-2.5 text-xs font-bold text-[#004B25]">
          <span>Inicio: {orden.hora_inicio_real?.slice(0, 5)}</span>
          {orden.hora_fin_real && (
            <span className="rounded-md bg-[#00A859]/20 px-2 py-1">
              Cierre OS (+7 min): {orden.hora_fin_real.slice(0, 5)}
            </span>
          )}
        </div>
      )}

      {/* PASO 1: iniciar */}
      {!iniciado && !cerrada && (
        <Tarjeta>
          <div className="space-y-3 text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white"
              style={{ background: VERDE }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <h3 className="text-base font-extrabold">Iniciar servicio en sitio</h3>
            <p className="mx-auto max-w-sm text-xs text-muted">
              Al iniciar se registra la hora de llegada y tu ubicación (para el
              mapa de gerencia).
            </p>
            <button
              type="button"
              onClick={iniciarServicio}
              disabled={ocupado}
              className={btnPrim}
              style={{ background: VERDE }}
            >
              {ocupado ? "Obteniendo ubicación…" : "▶  INICIAR SERVICIO"}
            </button>
          </div>
        </Tarjeta>
      )}

      {/* PASO 2: captura (bloqueada una vez generada la OS) */}
      {iniciado && (
        <>
          {osGenerada && (
            <div className="rounded-2xl border-2 border-[#00A859] bg-[#00A859]/5 p-4 text-center text-xs font-bold text-[#004B25]">
              🔒 Orden de servicio generada. Solo falta subir la OS firmada y
              cerrar.
            </div>
          )}

          <Tarjeta titulo="Evidencia fotográfica">
            <GrupoEvidencia
              ordenId={orden.id}
              tipo="llegada"
              label="Llegada en sitio"
              multiple={false}
              evidencias={evidencias}
              bloqueado={osGenerada}
            />
            <GrupoEvidencia
              ordenId={orden.id}
              tipo="antes"
              label="Antes (falla / estado inicial)"
              multiple
              evidencias={evidencias}
              bloqueado={osGenerada}
            />
            <GrupoEvidencia
              ordenId={orden.id}
              tipo="durante"
              label="Durante (proceso)"
              multiple
              evidencias={evidencias}
              bloqueado={osGenerada}
            />
            <GrupoEvidencia
              ordenId={orden.id}
              tipo="despues"
              label="Final (equipo listo y pruebas)"
              multiple
              evidencias={evidencias}
              bloqueado={osGenerada}
            />
            <GrupoEvidencia
              ordenId={orden.id}
              tipo="piezas"
              label="Piezas / refacciones"
              multiple
              evidencias={evidencias}
              bloqueado={osGenerada}
            />
          </Tarjeta>

          <Tarjeta titulo="Reportes exportados del equipo">
            <GrupoEvidencia
              ordenId={orden.id}
              tipo="reporte_equipo"
              label="Event log · informe activo · estadísticas"
              multiple
              soloImagen={false}
              evidencias={evidencias}
              bloqueado={osGenerada}
            />
          </Tarjeta>

          <Tarjeta titulo="Checklist de verificación (13 puntos)">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CHECKLIST_CAMPO.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-2/50 p-2.5 text-xs font-semibold"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#00A859]"
                    checked={!!checklist[item.key]}
                    disabled={osGenerada}
                    onChange={(e) => {
                      const next = { ...checklist, [item.key]: e.target.checked };
                      setChecklist(next);
                      guardarAvance({ checklist: next });
                    }}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Piezas y refacciones utilizadas">
            <PiezasCampo ordenId={orden.id} piezas={piezas} bloqueado={osGenerada} />
          </Tarjeta>

          <Tarjeta titulo="Contadores y trabajo realizado">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] font-bold text-muted">
                Contador monocromo
                <input
                  type="number"
                  inputMode="numeric"
                  value={mono}
                  disabled={osGenerada}
                  onChange={(e) => setMono(e.target.value)}
                  onBlur={() => guardarAvance({ contador_mono: mono })}
                  className="mt-1 w-full rounded-xl border border-border-default bg-surface-2/50 p-2.5 text-sm font-bold text-text"
                />
              </label>
              <label className="text-[11px] font-bold text-muted">
                Contador color
                <input
                  type="number"
                  inputMode="numeric"
                  value={color}
                  disabled={osGenerada}
                  onChange={(e) => setColor(e.target.value)}
                  onBlur={() => guardarAvance({ contador_color: color })}
                  className="mt-1 w-full rounded-xl border border-border-default bg-surface-2/50 p-2.5 text-sm font-bold text-text"
                />
              </label>
            </div>

            <div className="relative">
              <textarea
                rows={4}
                value={diag}
                disabled={osGenerada}
                placeholder="Escribe o dicta las actividades realizadas…"
                onChange={(e) => setDiag(e.target.value)}
                onBlur={() => guardarAvance({ diagnostico_campo: diag })}
                className="w-full rounded-2xl border border-border-default bg-surface-2/50 p-3 text-sm"
              />
              {!osGenerada && (
                <DictadoVoz
                  onTexto={(t) => setDiag((p) => (p ? `${p} ${t}` : t))}
                />
              )}
            </div>

            <label className="block text-[11px] font-bold text-muted">
              Estatus final del servicio
              <select
                value={estatusFinal}
                disabled={osGenerada}
                onChange={(e) =>
                  setEstatusFinal(e.target.value as "Concluido" | "Pendiente")
                }
                className="mt-1 w-full rounded-xl border border-border-default bg-surface-2/50 p-2.5 text-sm font-bold"
              >
                <option value="Concluido">Concluido</option>
                <option value="Pendiente">Pendiente (requiere seguimiento)</option>
              </select>
            </label>
          </Tarjeta>

          {/* PASO 3: generar / cerrar */}
          {!osGenerada && !cerrada && (
            <button
              type="button"
              onClick={generarOs}
              disabled={ocupado}
              className={btnPrim}
              style={{ background: VERDE }}
            >
              {ocupado ? "Generando…" : "🖨  GENERAR ORDEN DE SERVICIO"}
            </button>
          )}

          {osGenerada && !cerrada && (
            <Tarjeta>
              <GrupoEvidencia
                ordenId={orden.id}
                tipo="os_firmada"
                label="Orden de servicio firmada"
                multiple={false}
                evidencias={evidencias}
              />
              <button
                type="button"
                onClick={cerrar}
                disabled={ocupado}
                className={btnPrim}
                style={{ background: VERDE_OSC }}
              >
                {ocupado ? "Cerrando…" : "ENVIAR REPORTE FINAL Y CERRAR"}
              </button>
            </Tarjeta>
          )}

          {cerrada && (
            <div className="rounded-2xl bg-[#00A859]/10 p-4 text-center text-sm font-bold text-[#004B25]">
              Servicio {orden.estatus?.toLowerCase()}. Gracias.
            </div>
          )}
        </>
      )}
    </div>
  );
}
