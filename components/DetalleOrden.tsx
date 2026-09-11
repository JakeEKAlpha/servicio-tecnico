"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ESTATUS_MANUALES, ESTATUS_ORDEN } from "@/lib/ordenes/estatus";
import { boton, botonSec, campo } from "@/lib/ui";
import SelectorIngenieroSucursal, {
  type IngenieroOpcion,
} from "@/components/SelectorIngenieroSucursal";
import SelectorHora from "@/components/SelectorHora";
import Colapsable from "@/components/Colapsable";
import FichaOrden from "@/components/FichaOrden";
import Revelar from "@/components/Revelar";
import Modal from "@/components/Modal";
import CuentaLexmark from "@/components/CuentaLexmark";
import type { CuentaDirectorio } from "@/lib/cuentas/directorio";

function IconoDoc({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

type Ingeniero = IngenieroOpcion;
type HistorialItem = {
  estatus_anterior: string | null;
  estatus_nuevo: string | null;
  cambiado_en: string;
};

export type OrdenDetalle = {
  id: string;
  zona_id: string;
  numero_orden: string;
  numero_visita: number | null;
  origen: string | null;
  estatus: string | null;
  cliente: string | null;
  contacto: string | null;
  tel_fijo: string | null;
  tel_movil: string | null;
  direccion: string | null;
  localidad: string | null;
  estado: string | null;
  modelo: string | null;
  serie: string | null;
  falla: string | null;
  comentarios: string | null;
  sucursal: string | null;
  fecha_eta: string | null;
  hora_eta: string | null;
  ingeniero_id: string | null;
  ingeniero_nombre: string | null;
  marca_nombre: string | null;
  link_doc: string | null;
  link_pdf: string | null;
  datos_especificos: Record<string, string> | null;
};

/** Campo con doble clic para editar en línea. */
function CampoEditable({
  etiqueta,
  valor,
  campoKey,
  onGuardar,
  editable,
  multilinea = false,
}: {
  etiqueta: string;
  valor: string | null;
  campoKey: string;
  onGuardar: (campo: string, valor: string) => Promise<void>;
  editable: boolean;
  multilinea?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(valor ?? "");
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    if (borrador === (valor ?? "")) {
      setEditando(false);
      return;
    }
    setGuardando(true);
    await onGuardar(campoKey, borrador);
    setGuardando(false);
    setEditando(false);
  }

  if (editando) {
    return (
      <div className={multilinea ? "col-span-2 md:col-span-3" : ""}>
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
          {etiqueta}
        </dt>
        {multilinea ? (
          <textarea
            autoFocus
            rows={3}
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditando(false);
            }}
            className={campo + " mt-0.5"}
          />
        ) : (
          <input
            autoFocus
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmar();
              if (e.key === "Escape") setEditando(false);
            }}
            className={campo + " mt-0.5"}
          />
        )}
        {guardando && (
          <span className="text-xs text-muted">Guardando…</span>
        )}
      </div>
    );
  }

  return (
    <div className={multilinea ? "col-span-2 md:col-span-3" : ""}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {etiqueta}
      </dt>
      <dd
        onDoubleClick={() => {
          if (editable) {
            setBorrador(valor ?? "");
            setEditando(true);
          }
        }}
        title={editable ? "Doble clic para editar" : undefined}
        className={
          "whitespace-pre-wrap text-sm " +
          (editable
            ? "cursor-text rounded px-1 -mx-1 hover:bg-brand-050"
            : "")
        }
      >
        {valor || <span className="text-muted">—</span>}
      </dd>
    </div>
  );
}

export default function DetalleOrden({
  orden,
  ingenieros,
  historial,
  esGerencia,
  zonas = [],
  slotPiezas,
  cuenta = null,
}: {
  orden: OrdenDetalle;
  ingenieros: Ingeniero[];
  historial: HistorialItem[];
  esGerencia: boolean;
  zonas?: { id: string; nombre: string }[];
  slotPiezas?: React.ReactNode;
  cuenta?: CuentaDirectorio | null;
}) {
  const router = useRouter();
  const bloqueada =
    orden.estatus === "Concluido" || orden.estatus === "Cancelado";
  const editable = !bloqueada || esGerencia;

  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null,
  );
  const [enviando, setEnviando] = useState(false);

  const [estatus, setEstatus] = useState(orden.estatus ?? "Nuevo");
  const [confirmarEstatus, setConfirmarEstatus] = useState<string | null>(null);
  const [zonaId, setZonaId] = useState(orden.zona_id);
  const [fecha, setFecha] = useState(orden.fecha_eta ?? "");
  const [hora, setHora] = useState(orden.hora_eta ?? "");
  const [ingeniero, setIngeniero] = useState(orden.ingeniero_id ?? "");
  const [sucursal, setSucursal] = useState(orden.sucursal ?? "");

  const opcionesEstatus = esGerencia ? ESTATUS_ORDEN : ESTATUS_MANUALES;

  async function patch(body: Record<string, unknown>, exito: string) {
    setEnviando(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/ordenes/${orden.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setMsg({ tipo: "error", texto: data.error ?? "No se pudo guardar." });
      } else {
        setMsg({
          tipo: "ok",
          texto: data.aviso ? `${exito} (${data.aviso})` : exito,
        });
        router.refresh();
      }
    } catch {
      setMsg({ tipo: "error", texto: "Error de red." });
    } finally {
      setEnviando(false);
    }
  }

  const guardarCampo = (campoKey: string, valor: string) =>
    patch({ detalle: { [campoKey]: valor } }, "Dato actualizado.");

  // Cambio rápido de estatus desde la ficha (la pastilla ES el selector).
  async function cambiarEstatus(nuevo: string) {
    if (nuevo === (orden.estatus ?? "Nuevo")) return;
    if (nuevo === "Concluido" || nuevo === "Cancelado") {
      setConfirmarEstatus(nuevo);
      return;
    }
    const previo = estatus;
    setEstatus(nuevo);
    setEnviando(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/ordenes/${orden.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estatus: nuevo }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setEstatus(previo);
        setMsg({ tipo: "error", texto: data.error ?? "No se pudo guardar." });
      } else {
        setMsg({
          tipo: "ok",
          texto: data.aviso ? `Estatus actualizado (${data.aviso})` : "Estatus actualizado.",
        });
        router.refresh();
      }
    } catch {
      setEstatus(previo);
      setMsg({ tipo: "error", texto: "Error de red." });
    } finally {
      setEnviando(false);
    }
  }

  async function generarDoc() {
    setEnviando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/documentos/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orden_id: orden.id }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setMsg({ tipo: "error", texto: data.error ?? "No se pudo generar." });
      } else {
        setMsg({ tipo: "ok", texto: "Documento generado." });
        router.refresh();
      }
    } catch {
      setMsg({ tipo: "error", texto: "Error de red." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Revelar>
        <FichaOrden
          orden={orden}
          estatus={estatus}
          opciones={opcionesEstatus}
          onCambiarEstatus={cambiarEstatus}
          bloqueada={bloqueada && !esGerencia}
          onGenerarDoc={generarDoc}
          generandoDoc={enviando}
          puedeGenerarDoc={!!orden.ingeniero_id && !!orden.fecha_eta}
        />
      </Revelar>

      {/* Confirmar Concluir / Cancelar */}
      {confirmarEstatus && (
        <Modal
          titulo={`${confirmarEstatus === "Concluido" ? "Concluir" : "Cancelar"} orden ${orden.numero_orden}`}
          ancho="max-w-sm"
          centrado
          onClose={() => setConfirmarEstatus(null)}
        >
          <h2 className="text-base font-bold">
            {confirmarEstatus === "Concluido"
              ? "Concluir orden"
              : "Cancelar orden"}{" "}
            {orden.numero_orden}
          </h2>
          <p className="text-sm text-muted">
            {confirmarEstatus === "Concluido"
              ? "Concluye la orden (y sus visitas). Revísalo antes de continuar."
              : "La orden quedará cancelada y ya no se podrá editar desde zona."}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={botonSec}
              onClick={() => setConfirmarEstatus(null)}
            >
              No
            </button>
            <button
              type="button"
              className={boton}
              disabled={enviando}
              onClick={async () => {
                const dest = confirmarEstatus;
                setConfirmarEstatus(null);
                setEstatus(dest);
                await patch({ estatus: dest }, "Estatus actualizado.");
              }}
            >
              Sí, continuar
            </button>
          </div>
        </Modal>
      )}

      <p
        aria-live="polite"
        role="status"
        className={
          msg
            ? "rounded-lg px-3 py-2 text-sm " +
              (msg.tipo === "ok"
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger")
            : "sr-only"
        }
      >
        {msg?.texto}
      </p>

      {bloqueada && (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
          Orden {orden.estatus?.toLowerCase()}: no se puede modificar
          {esGerencia ? " salvo desde gerencia." : "."}
        </p>
      )}

      {orden.origen === "SR" && (
        <p className="rounded-lg bg-tone-orange-bg px-3 py-2 text-sm text-tone-orange-fg">
          SR / proactiva: primero la pieza. Registra abajo la(s) pieza(s) “en
          espera”; cuando Almacén confirme el arribo, la orden pasa a “Lista
          para realizar” y ya se puede agendar.
        </p>
      )}

      {/* Dos columnas en escritorio: izq = piezas + datos, der = agendar + doc + historial */}
      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
      <div className="space-y-4 lg:col-span-7">

      {/* Piezas — lo que más se consulta */}
      <Revelar delay={60}>{slotPiezas}</Revelar>

      {/* Datos del servicio — doble clic para editar */}
      <Revelar delay={120}>
      <Colapsable
        id={"datos-" + orden.id}
        titulo="Datos del servicio"
        resumen={orden.cliente ?? "—"}
        icono={<IconoDoc d="M9 12h6m-6 4h6M9 8h6M5 4h14v16H5z" />}
      >
        <p className="mb-3 text-xs text-muted">
          Doble clic en un dato para editarlo.
        </p>

        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand">
          Cliente y ubicación
        </h3>
        <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
          <CampoEditable etiqueta="Cliente" valor={orden.cliente} campoKey="cliente" onGuardar={guardarCampo} editable={editable} />
          <CampoEditable etiqueta="Contacto" valor={orden.contacto} campoKey="contacto" onGuardar={guardarCampo} editable={editable} />
          <CampoEditable etiqueta="Tel. móvil" valor={orden.tel_movil} campoKey="tel_movil" onGuardar={guardarCampo} editable={editable} />
          <CampoEditable etiqueta="Tel. fijo" valor={orden.tel_fijo} campoKey="tel_fijo" onGuardar={guardarCampo} editable={editable} />
          <CampoEditable etiqueta="Dirección" valor={orden.direccion} campoKey="direccion" onGuardar={guardarCampo} editable={editable} />
          <CampoEditable etiqueta="Localidad" valor={orden.localidad} campoKey="localidad" onGuardar={guardarCampo} editable={editable} />
          <CampoEditable etiqueta="Estado" valor={orden.estado} campoKey="estado" onGuardar={guardarCampo} editable={editable} />
        </dl>

        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand">
          Equipo
        </h3>
        <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
          <CampoEditable etiqueta="Modelo" valor={orden.modelo} campoKey="modelo" onGuardar={guardarCampo} editable={editable} />
          <CampoEditable etiqueta="Serie" valor={orden.serie} campoKey="serie" onGuardar={guardarCampo} editable={editable} />
        </dl>

        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand">
          Falla / resumen
        </h3>
        <dl className="grid grid-cols-1 gap-3">
          <CampoEditable etiqueta="Falla reportada" valor={orden.falla} campoKey="falla" onGuardar={guardarCampo} editable={editable} multilinea />
          <CampoEditable etiqueta="Comentarios" valor={orden.comentarios} campoKey="comentarios" onGuardar={guardarCampo} editable={editable} multilinea />
        </dl>

        {orden.datos_especificos &&
          Object.keys(orden.datos_especificos).length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer font-medium text-muted">
                Datos específicos
              </summary>
              <dl className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                {Object.entries(orden.datos_especificos).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
      </Colapsable>
      </Revelar>

      </div>
      <div className="space-y-4 lg:col-span-5">

      {/* Cuenta Lexmark: requisitos + mesa de servicio */}
      {cuenta && (
        <Revelar delay={75}>
        <Colapsable
          id={"cuenta-" + orden.id}
          titulo="Cuenta / mesa de servicio"
          resumen={
            cuenta.contratos.length > 0
              ? `${cuenta.contratos.length} contrato(s) vigente(s)`
              : cuenta.indicaciones
                ? "Con requisitos de acceso"
                : `${cuenta.contactos.length} contacto(s)`
          }
          defaultAbierto={!!cuenta.indicaciones || cuenta.contratos.length > 0}
          icono={<IconoDoc d="M12 3l8 4v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7z" />}
        >
          <p className="mb-2 text-xs text-muted">
            Emparejado con «{cuenta.nombre}».
          </p>
          <CuentaLexmark cuenta={cuenta} />
        </Colapsable>
        </Revelar>
      )}

      {/* Asignar / reasignar */}
      <Revelar delay={90}>
      <Colapsable
        id={"asignar-" + orden.id}
        titulo="Asignar visita"
        resumen={
          orden.ingeniero_nombre
            ? `${orden.ingeniero_nombre} · ${orden.fecha_eta ?? "sin fecha"}`
            : "Sin asignar"
        }
        icono={<IconoDoc d="M5 4h14v16H5zM5 9h14M9 4v16" />}
      >
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 sm:items-start">
          <div>
            <span className="mb-1 block text-xs font-semibold text-muted">
              Fecha ETA
            </span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={bloqueada}
              className={campo}
            />
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold text-muted">
              Hora ETA
            </span>
            <SelectorHora valor={hora} onCambio={setHora} disabled={bloqueada} />
          </div>
          <SelectorIngenieroSucursal
            ingenieros={ingenieros}
            sucursal={sucursal}
            ingenieroId={ingeniero}
            onSucursal={setSucursal}
            onIngeniero={setIngeniero}
            disabled={bloqueada}
          />
        </div>
        <button
          type="button"
          className={boton + " mt-3"}
          disabled={enviando || bloqueada || !fecha || !hora || !ingeniero}
          onClick={() =>
            patch(
              {
                fecha_eta: fecha,
                hora_eta: hora,
                ingeniero_id: ingeniero,
                sucursal,
              },
              "Orden asignada.",
            )
          }
        >
          Asignar y generar documento
        </button>
      </Colapsable>
      </Revelar>

      {/* Mover a otra zona (solo gerencia) */}
      {esGerencia && zonas.length > 0 && (
        <Revelar delay={150}>
        <Colapsable
          id={"zona-" + orden.id}
          titulo="Mover a otra zona"
          defaultAbierto={false}
          icono={<IconoDoc d="M7 7h10v10M7 17L17 7" />}
        >
          <div className="flex items-center gap-2">
            <select
              value={zonaId}
              onChange={(e) => setZonaId(e.target.value)}
              className={campo + " max-w-xs"}
            >
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={boton}
              disabled={enviando || zonaId === orden.zona_id}
              onClick={() => patch({ zona_id: zonaId }, "Orden movida de zona.")}
            >
              Mover
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Útil cuando una WO llegó a la zona equivocada.
          </p>
        </Colapsable>
        </Revelar>
      )}

      {/* Historial */}
      <Revelar delay={180}>
      <Colapsable
        id={"hist-" + orden.id}
        titulo="Historial de estatus"
        resumen={`${historial.length} cambio(s)`}
        defaultAbierto={false}
        icono={<IconoDoc d="M12 8v4l3 2M21 12a9 9 0 1 1-3-6.7" />}
      >
        {historial.length === 0 ? (
          <p className="text-sm text-muted">Sin cambios registrados.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {historial.map((h, i) => (
              <li key={i} className="text-muted">
                {new Date(h.cambiado_en).toLocaleString("es-MX")} ·{" "}
                {h.estatus_anterior ?? "—"} → {h.estatus_nuevo}
              </li>
            ))}
          </ul>
        )}
      </Colapsable>
      </Revelar>

      </div>
      </div>
    </div>
  );
}
