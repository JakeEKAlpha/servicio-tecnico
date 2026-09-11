"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SelectorIngenieroSucursal, {
  type IngenieroOpcion,
  type SucursalOpcion,
} from "@/components/SelectorIngenieroSucursal";
import { boton, botonSec, campo as campoCls, etiqueta } from "@/lib/ui";
import SelectorHora from "@/components/SelectorHora";
import Modal from "@/components/Modal";

export type MarcaOpcion = { id: string; nombre: string };
export type ClienteOpcion = { id: string; nombre: string };
export type EquipoOpcion = {
  id: string;
  cliente_id: string | null;
  marca_id: string | null;
  modelo: string;
  serie: string | null;
};

type Datos = {
  cliente: string;
  falla: string;
  origen: "MANUAL" | "WO" | "SR";
  marca_id: string;
  numero_orden: string;
  contacto: string;
  tel_fijo: string;
  tel_movil: string;
  direccion: string;
  localidad: string;
  estado: string;
  modelo: string;
  serie: string;
  fecha_eta: string;
  hora_eta: string;
  sucursal: string;
  ingeniero_id: string;
  cliente_id: string;
  equipo_id: string;
};

function vacio(marcaPorDefecto: string): Datos {
  return {
    cliente: "",
    falla: "",
    origen: "MANUAL",
    marca_id: marcaPorDefecto,
    numero_orden: "",
    contacto: "",
    tel_fijo: "",
    tel_movil: "",
    direccion: "",
    localidad: "",
    estado: "",
    modelo: "",
    serie: "",
    fecha_eta: "",
    hora_eta: "",
    sucursal: "",
    ingeniero_id: "",
    cliente_id: "",
    equipo_id: "",
  };
}

/** Punto de progreso 1/2, wireframe 9b ("nueva orden en dos pasos"). */
function Progreso({ paso }: { paso: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold text-muted">
      {[1, 2].map((n) => (
        <span key={n} className="flex items-center gap-2">
          <span
            className={
              "flex h-5 w-5 items-center justify-center rounded-full " +
              (n <= paso
                ? "bg-brand text-brand-fg"
                : "bg-surface-2 text-muted")
            }
          >
            {n}
          </span>
          {n === 1 ? "Datos del servicio" : "Agendar"}
          {n === 1 && <span className="mx-1 h-px w-6 bg-border-default" />}
        </span>
      ))}
    </div>
  );
}

export default function ModalNuevaOrden({
  ingenieros,
  sucursales,
  marcas,
  clientes,
  equipos,
}: {
  ingenieros: IngenieroOpcion[];
  sucursales?: SucursalOpcion[];
  marcas: MarcaOpcion[];
  clientes: ClienteOpcion[];
  equipos: EquipoOpcion[];
}) {
  const router = useRouter();
  // Lexmark sigue siendo el default (es lo más común hoy), pero ahora es una
  // elección visible, no un valor oculto del servidor — antes toda orden
  // manual quedaba marcada Lexmark sin que hubiera forma de cambiarlo.
  const marcaDefecto =
    marcas.find((m) => m.nombre.toLowerCase() === "lexmark")?.id ??
    marcas[0]?.id ??
    "";
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [agendar, setAgendar] = useState(false);
  const [d, setD] = useState<Datos>(() => vacio(marcaDefecto));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  function set<K extends keyof Datos>(k: K, v: Datos[K]) {
    setD((prev) => ({ ...prev, [k]: v }));
  }

  function abrir() {
    setAbierto(true);
    setPaso(1);
    setAgendar(false);
  }

  function cerrar() {
    setAbierto(false);
    setD(vacio(marcaDefecto));
    setError(null);
    setExito(null);
    setEnviando(false);
  }

  const paso1Ok = d.cliente.trim() !== "" && d.falla.trim() !== "";

  async function guardar() {
    setEnviando(true);
    setError(null);
    setExito(null);
    // Si "sin agendar" quedó elegido, no se manda fecha/hora/asignación —
    // aunque el usuario haya tecleado algo antes de retroceder.
    const datos = agendar
      ? d
      : { ...d, fecha_eta: "", hora_eta: "", sucursal: "", ingeniero_id: "" };
    try {
      const r = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error ?? "No se pudo crear la orden.");
      } else {
        setExito(
          `Orden ${data.numero_orden} creada (${data.estatus})` +
            (data.aviso ? ` — ${data.aviso}` : ""),
        );
        router.refresh();
      }
    } catch {
      setError("Error de red.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button type="button" onClick={abrir} className={boton}>
        Nueva orden
      </button>

      {abierto && (
        <Modal titulo="Nueva orden manual" ancho="max-w-2xl" onClose={cerrar}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-extrabold text-brand">Nueva orden manual</h2>
            <button
              type="button"
              onClick={cerrar}
              className="text-[12px] font-bold text-muted hover:text-text"
            >
              Cerrar
            </button>
          </div>

          {!exito && <Progreso paso={paso} />}

          {/* --- Paso 1: lo obligatorio --- */}
          {paso === 1 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  <span className={etiqueta}>Cliente *</span>
                  <input
                    className={campoCls}
                    value={d.cliente}
                    onChange={(e) => set("cliente", e.target.value)}
                    autoFocus
                  />
                </label>
                <label className="text-sm">
                  <span className={etiqueta}>Vincular a cliente existente (opcional)</span>
                  <select
                    className={campoCls}
                    value={d.cliente_id}
                    onChange={(e) => {
                      set("cliente_id", e.target.value);
                      // Cambiar de cliente invalida el equipo elegido antes.
                      set("equipo_id", "");
                    }}
                  >
                    <option value="">— sin vincular —</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                {d.cliente_id && (
                  <label className="text-sm">
                    <span className={etiqueta}>Equipo (opcional)</span>
                    <select
                      className={campoCls}
                      value={d.equipo_id}
                      onChange={(e) => set("equipo_id", e.target.value)}
                    >
                      <option value="">— sin vincular —</option>
                      {equipos
                        .filter(
                          (e) =>
                            e.cliente_id === d.cliente_id &&
                            (!d.marca_id || e.marca_id === d.marca_id),
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.modelo}
                            {e.serie ? ` — ${e.serie}` : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label className="text-sm sm:col-span-2">
                  <span className={etiqueta}>Falla / motivo *</span>
                  <textarea
                    rows={2}
                    className={campoCls}
                    value={d.falla}
                    onChange={(e) => set("falla", e.target.value)}
                  />
                </label>

                <label className="text-sm">
                  <span className={etiqueta}>Marca</span>
                  <select
                    className={campoCls}
                    value={d.marca_id}
                    onChange={(e) => set("marca_id", e.target.value)}
                  >
                    {marcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className={etiqueta}>Origen</span>
                  <select
                    className={campoCls}
                    value={d.origen}
                    onChange={(e) =>
                      set("origen", e.target.value as Datos["origen"])
                    }
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="WO">WO</option>
                    <option value="SR">SR</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className={etiqueta}>Número de orden (opcional)</span>
                  <input
                    className={campoCls}
                    placeholder="se genera MAN-… si lo dejas vacío"
                    value={d.numero_orden}
                    onChange={(e) => set("numero_orden", e.target.value)}
                  />
                </label>

                <label className="text-sm">
                  <span className={etiqueta}>Modelo</span>
                  <input
                    className={campoCls}
                    value={d.modelo}
                    onChange={(e) => set("modelo", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className={etiqueta}>Número de serie</span>
                  <input
                    className={campoCls}
                    value={d.serie}
                    onChange={(e) => set("serie", e.target.value)}
                  />
                </label>

                <label className="text-sm">
                  <span className={etiqueta}>Contacto</span>
                  <input
                    className={campoCls}
                    value={d.contacto}
                    onChange={(e) => set("contacto", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className={etiqueta}>Teléfono móvil</span>
                  <input
                    className={campoCls}
                    value={d.tel_movil}
                    onChange={(e) => set("tel_movil", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className={etiqueta}>Teléfono fijo</span>
                  <input
                    className={campoCls}
                    value={d.tel_fijo}
                    onChange={(e) => set("tel_fijo", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className={etiqueta}>Dirección</span>
                  <input
                    className={campoCls}
                    value={d.direccion}
                    onChange={(e) => set("direccion", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className={etiqueta}>Localidad</span>
                  <input
                    className={campoCls}
                    value={d.localidad}
                    onChange={(e) => set("localidad", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className={etiqueta}>Estado</span>
                  <input
                    className={campoCls}
                    value={d.estado}
                    onChange={(e) => set("estado", e.target.value)}
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={cerrar} className={botonSec}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setPaso(2)}
                  disabled={!paso1Ok}
                  className={boton}
                >
                  Siguiente
                </button>
              </div>
            </>
          )}

          {/* --- Paso 2: agendar (opcional, decisión explícita) --- */}
          {paso === 2 && !exito && (
            <>
              <div className="flex gap-2 rounded-lg bg-surface-2 p-1">
                <button
                  type="button"
                  onClick={() => setAgendar(false)}
                  className={
                    "flex-1 rounded-md py-1.5 text-[12px] font-extrabold transition-colors " +
                    (!agendar ? "bg-surface text-text shadow-sm" : "text-muted")
                  }
                >
                  Sin agendar
                </button>
                <button
                  type="button"
                  onClick={() => setAgendar(true)}
                  className={
                    "flex-1 rounded-md py-1.5 text-[12px] font-extrabold transition-colors " +
                    (agendar ? "bg-surface text-text shadow-sm" : "text-muted")
                  }
                >
                  Agendar ahora
                </button>
              </div>

              {agendar ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className={etiqueta}>Fecha ETA</span>
                    <input
                      type="date"
                      className={campoCls}
                      value={d.fecha_eta}
                      onChange={(e) => set("fecha_eta", e.target.value)}
                    />
                  </label>
                  <div className="text-sm">
                    <span className={etiqueta}>Hora ETA</span>
                    <SelectorHora
                      valor={d.hora_eta}
                      onCambio={(t) => set("hora_eta", t)}
                    />
                  </div>
                  <SelectorIngenieroSucursal
                    ingenieros={ingenieros}
                    sucursales={sucursales}
                    sucursal={d.sucursal}
                    ingenieroId={d.ingeniero_id}
                    onSucursal={(s) => set("sucursal", s)}
                    onIngeniero={(id) => set("ingeniero_id", id)}
                  />
                  <p className="text-xs text-muted sm:col-span-2">
                    Con fecha ETA + ingeniero, la orden nace “Asignado” y se
                    genera el documento.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  La orden nace “Nuevo”, sin ingeniero ni fecha. La agendas
                  después desde el tablero.
                </p>
              )}

              {error && <p className="text-sm text-danger">{error}</p>}

              <div className="flex justify-between gap-2">
                <button type="button" onClick={() => setPaso(1)} className={botonSec}>
                  Atrás
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={cerrar} className={botonSec}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={guardar}
                    disabled={enviando}
                    className={boton}
                  >
                    {enviando ? "Creando…" : "Crear orden"}
                  </button>
                </div>
              </div>
            </>
          )}

          {exito && (
            <>
              <p className="rounded-lg bg-tone-ok-bg px-3 py-2 text-sm text-tone-ok-fg">
                {exito}
              </p>
              <div className="flex justify-end">
                <button type="button" onClick={cerrar} className={boton}>
                  Listo
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
