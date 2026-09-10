"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SelectorIngenieroSucursal, {
  type IngenieroOpcion,
} from "@/components/SelectorIngenieroSucursal";
import { boton, botonSec, campo as campoCls } from "@/lib/ui";
import SelectorHora from "@/components/SelectorHora";
import Modal from "@/components/Modal";

type Datos = {
  cliente: string;
  falla: string;
  origen: "MANUAL" | "WO" | "SR";
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
};

const VACIO: Datos = {
  cliente: "",
  falla: "",
  origen: "MANUAL",
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
};

export default function ModalNuevaOrden({
  ingenieros,
}: {
  ingenieros: IngenieroOpcion[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState<Datos>(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  function set<K extends keyof Datos>(k: K, v: Datos[K]) {
    setD((prev) => ({ ...prev, [k]: v }));
  }

  function cerrar() {
    setAbierto(false);
    setD(VACIO);
    setError(null);
    setExito(null);
    setEnviando(false);
  }

  async function guardar() {
    setEnviando(true);
    setError(null);
    setExito(null);
    try {
      const r = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
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
      <button type="button" onClick={() => setAbierto(true)} className={boton}>
        Nueva orden
      </button>

      {abierto && (
        <Modal titulo="Nueva orden manual" ancho="max-w-2xl" onClose={cerrar}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand">Nueva orden manual</h2>
              <button
                type="button"
                onClick={cerrar}
                className="text-sm text-muted hover:text-text"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                Cliente *
                <input
                  className={campoCls}
                  value={d.cliente}
                  onChange={(e) => set("cliente", e.target.value)}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Falla / motivo *
                <textarea
                  rows={2}
                  className={campoCls}
                  value={d.falla}
                  onChange={(e) => set("falla", e.target.value)}
                />
              </label>

              <label className="text-sm">
                Origen
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
                Número de orden (opcional)
                <input
                  className={campoCls}
                  placeholder="se genera MAN-… si lo dejas vacío"
                  value={d.numero_orden}
                  onChange={(e) => set("numero_orden", e.target.value)}
                />
              </label>

              <label className="text-sm">
                Modelo
                <input
                  className={campoCls}
                  value={d.modelo}
                  onChange={(e) => set("modelo", e.target.value)}
                />
              </label>
              <label className="text-sm">
                Número de serie
                <input
                  className={campoCls}
                  value={d.serie}
                  onChange={(e) => set("serie", e.target.value)}
                />
              </label>

              <label className="text-sm">
                Contacto
                <input
                  className={campoCls}
                  value={d.contacto}
                  onChange={(e) => set("contacto", e.target.value)}
                />
              </label>
              <label className="text-sm">
                Teléfono móvil
                <input
                  className={campoCls}
                  value={d.tel_movil}
                  onChange={(e) => set("tel_movil", e.target.value)}
                />
              </label>
              <label className="text-sm">
                Teléfono fijo
                <input
                  className={campoCls}
                  value={d.tel_fijo}
                  onChange={(e) => set("tel_fijo", e.target.value)}
                />
              </label>
              <label className="text-sm">
                Dirección
                <input
                  className={campoCls}
                  value={d.direccion}
                  onChange={(e) => set("direccion", e.target.value)}
                />
              </label>
              <label className="text-sm">
                Localidad
                <input
                  className={campoCls}
                  value={d.localidad}
                  onChange={(e) => set("localidad", e.target.value)}
                />
              </label>
              <label className="text-sm">
                Estado
                <input
                  className={campoCls}
                  value={d.estado}
                  onChange={(e) => set("estado", e.target.value)}
                />
              </label>

              <label className="text-sm">
                Fecha ETA
                <input
                  type="date"
                  className={campoCls}
                  value={d.fecha_eta}
                  onChange={(e) => set("fecha_eta", e.target.value)}
                />
              </label>
              <div className="text-sm">
                <span className="mb-1 block">Hora ETA</span>
                <SelectorHora
                  valor={d.hora_eta}
                  onCambio={(t) => set("hora_eta", t)}
                />
              </div>

              <SelectorIngenieroSucursal
                ingenieros={ingenieros}
                sucursal={d.sucursal}
                ingenieroId={d.ingeniero_id}
                onSucursal={(s) => set("sucursal", s)}
                onIngeniero={(id) => set("ingeniero_id", id)}
              />
            </div>

            <p className="text-xs text-muted">
              Si pones Fecha ETA + Ingeniero, la orden nace “Asignado” y se
              genera el documento.
            </p>

            {error && <p className="text-sm text-danger">{error}</p>}
            {exito && <p className="text-sm text-success">{exito}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={cerrar} className={botonSec}>
                {exito ? "Listo" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={
                  enviando || !d.cliente.trim() || !d.falla.trim() || !!exito
                }
                className={boton}
              >
                {enviando ? "Creando…" : "Crear orden"}
              </button>
            </div>
        </Modal>
      )}
    </>
  );
}
