"use client";

import { useState } from "react";
import { campo as campoCls } from "@/lib/ui";

export type IngenieroOpcion = {
  id: string;
  nombre: string;
  sucursal: string | null;
};

export type SucursalOpcion = { nombre: string };

/**
 * Par de desplegables Sucursal + Ingeniero:
 *  - al elegir sucursal, el desplegable de ingeniero se filtra a esa sucursal
 *  - opción "➕ Ver ingenieros de otras sucursales…" para ver el resto
 *  - al elegir ingeniero, la sucursal se alinea con la suya
 *
 * Componente controlado: el padre guarda `sucursal` e `ingenieroId`. El
 * valor que viaja sigue siendo el **nombre** de la sucursal (texto) — eso no
 * cambia, es lo que ya resuelve el trigger de `ordenes.sucursal_id` en la BD.
 *
 * `sucursales`: lista canónica de la tabla `sucursales` para las opciones del
 * primer desplegable — antes se armaba de los valores únicos de
 * `ingenieros.sucursal`, lo que dejaba fuera sucursales sin ingenieros
 * todavía y podía inventar una "sucursal fantasma" por un typo. Si no se
 * pasa (compatibilidad), cae al comportamiento anterior.
 */
export default function SelectorIngenieroSucursal({
  ingenieros,
  sucursales: sucursalesProp,
  sucursal,
  ingenieroId,
  onSucursal,
  onIngeniero,
  disabled,
}: {
  ingenieros: IngenieroOpcion[];
  sucursales?: SucursalOpcion[];
  sucursal: string;
  ingenieroId: string;
  onSucursal: (s: string) => void;
  onIngeniero: (id: string) => void;
  disabled?: boolean;
}) {
  const [verTodos, setVerTodos] = useState(false);

  const sucursales = sucursalesProp
    ? [...new Set(sucursalesProp.map((s) => s.nombre))].sort()
    : [
        ...new Set(
          ingenieros.map((i) => i.sucursal).filter((s): s is string => !!s),
        ),
      ].sort();

  const visibles =
    verTodos || !sucursal
      ? ingenieros
      : ingenieros.filter((i) => i.sucursal === sucursal);

  function elegirSucursal(nueva: string) {
    onSucursal(nueva);
    setVerTodos(false);
    const ing = ingenieros.find((i) => i.id === ingenieroId);
    if (nueva && ing && ing.sucursal !== nueva) onIngeniero("");
  }

  function elegirIngeniero(valor: string) {
    if (valor === "__ver_todos__") {
      setVerTodos(true);
      return;
    }
    onIngeniero(valor);
    const ing = ingenieros.find((i) => i.id === valor);
    if (ing?.sucursal) onSucursal(ing.sucursal);
  }

  const label = "mb-1 block text-xs font-semibold text-muted";

  return (
    <>
      <div>
        <span className={label}>Sucursal</span>
        <select
          value={sucursal}
          onChange={(e) => elegirSucursal(e.target.value)}
          disabled={disabled}
          className={campoCls}
        >
          <option value="">— todas —</option>
          {sucursales.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <span className={label}>Ingeniero</span>
        <select
          value={ingenieroId}
          onChange={(e) => elegirIngeniero(e.target.value)}
          disabled={disabled}
          className={campoCls}
        >
          <option value="">— elegir —</option>
          {visibles.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre}
              {(verTodos || !sucursal) && i.sucursal ? ` · ${i.sucursal}` : ""}
            </option>
          ))}
          {!verTodos && sucursal && (
            <option value="__ver_todos__">
              ➕ Ver ingenieros de otras sucursales…
            </option>
          )}
        </select>
      </div>
    </>
  );
}
