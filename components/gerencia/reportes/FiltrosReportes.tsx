import Link from "next/link";
import { ESTATUS_ORDEN } from "@/lib/ordenes/estatus";
import type { OpcionesFiltro } from "@/lib/reportes/datos";
import { campo, etiqueta, boton, botonSec } from "@/lib/ui";

export type ValoresFiltro = {
  desde: string;
  hasta: string;
  zona: string;
  sucursal: string;
  marca: string;
  ingeniero: string;
  origen: string;
  estatus: string;
};

const ORIGENES = [
  { value: "WO", label: "WO Lexmark" },
  { value: "SR", label: "SR Lexmark" },
  { value: "MANUAL", label: "Alpha Digital (manual)" },
];

/**
 * Barra de filtros — form GET plano, sin JS: recarga `/gerencia/reportes`
 * con la query string. Mismo concepto que el dashboard de referencia
 * (fecha, sucursal, ingeniero, estatus), adaptado a los catálogos reales
 * de la app (zona, marca, origen en vez de "asignación"/"cuenta" en texto
 * libre).
 */
export default function FiltrosReportes({
  valores,
  opciones,
}: {
  valores: ValoresFiltro;
  opciones: OpcionesFiltro;
}) {
  return (
    <form
      method="GET"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border-default bg-surface p-3 shadow-sm"
    >
      <div>
        <label className={etiqueta} htmlFor="f-desde">Desde</label>
        <input id="f-desde" type="date" name="desde" defaultValue={valores.desde} className={campo} />
      </div>
      <div>
        <label className={etiqueta} htmlFor="f-hasta">Hasta</label>
        <input id="f-hasta" type="date" name="hasta" defaultValue={valores.hasta} className={campo} />
      </div>
      <div>
        <label className={etiqueta} htmlFor="f-zona">Zona</label>
        <select id="f-zona" name="zona" defaultValue={valores.zona} className={campo}>
          <option value="">Todas</option>
          {opciones.zonas.map((z) => (
            <option key={z.id} value={z.id}>{z.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={etiqueta} htmlFor="f-sucursal">Sucursal</label>
        <select id="f-sucursal" name="sucursal" defaultValue={valores.sucursal} className={campo}>
          <option value="">Todas</option>
          {opciones.sucursales.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={etiqueta} htmlFor="f-marca">Marca</label>
        <select id="f-marca" name="marca" defaultValue={valores.marca} className={campo}>
          <option value="">Todas</option>
          {opciones.marcas.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={etiqueta} htmlFor="f-ingeniero">Ingeniero</label>
        <select id="f-ingeniero" name="ingeniero" defaultValue={valores.ingeniero} className={campo}>
          <option value="">Todos</option>
          {opciones.ingenieros.map((i) => (
            <option key={i.id} value={i.id}>{i.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={etiqueta} htmlFor="f-origen">Origen</label>
        <select id="f-origen" name="origen" defaultValue={valores.origen} className={campo}>
          <option value="">Todos</option>
          {ORIGENES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={etiqueta} htmlFor="f-estatus">Estatus</label>
        <select id="f-estatus" name="estatus" defaultValue={valores.estatus} className={campo}>
          <option value="">Todos</option>
          {ESTATUS_ORDEN.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" className={boton}>Aplicar</button>
        <Link href="/gerencia/reportes?limpio=1" className={botonSec}>Limpiar</Link>
      </div>
    </form>
  );
}
