// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import SelectorIngenieroSucursal from "./SelectorIngenieroSucursal";

const ingenieros = [
  { id: "i1", nombre: "Juan Perez", sucursal: "Cancún" },
  { id: "i2", nombre: "Maria Lopez", sucursal: "Tuxtla" },
];

/** Los dos <select> del componente no tienen <label htmlFor>, así que se
 *  identifican por orden: 0 = Sucursal, 1 = Ingeniero. */
function selects() {
  return screen.getAllByRole("combobox") as HTMLSelectElement[];
}

describe("SelectorIngenieroSucursal", () => {
  it("sin prop `sucursales` (compatibilidad), arma las opciones desde los ingenieros", () => {
    render(
      <SelectorIngenieroSucursal
        ingenieros={ingenieros}
        sucursal=""
        ingenieroId=""
        onSucursal={() => {}}
        onIngeniero={() => {}}
      />,
    );
    const [selectSucursal] = selects();
    const opciones = within(selectSucursal)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opciones).toEqual(["— todas —", "Cancún", "Tuxtla"]);
  });

  it("con prop `sucursales`, usa la tabla canónica y no lo que ya tienen los ingenieros — esto es lo que arregla el bug real: una sucursal sin ingenieros todavía sí debe aparecer", () => {
    render(
      <SelectorIngenieroSucursal
        ingenieros={ingenieros}
        sucursales={[{ nombre: "Cancún" }, { nombre: "Playa del Carmen" }]}
        sucursal=""
        ingenieroId=""
        onSucursal={() => {}}
        onIngeniero={() => {}}
      />,
    );
    const [selectSucursal] = selects();
    const opciones = within(selectSucursal)
      .getAllByRole("option")
      .map((o) => o.textContent);
    // "Playa del Carmen" no tiene ningún ingeniero en la lista de arriba —
    // con el comportamiento viejo (derivar de ingenieros) jamás aparecería.
    expect(opciones).toEqual(["— todas —", "Cancún", "Playa del Carmen"]);
  });

  it("al elegir una sucursal, el desplegable de ingeniero se filtra a esa sucursal", () => {
    render(
      <SelectorIngenieroSucursal
        ingenieros={ingenieros}
        sucursal="Tuxtla"
        ingenieroId=""
        onSucursal={() => {}}
        onIngeniero={() => {}}
      />,
    );
    const [, selectIngeniero] = selects();
    const opciones = within(selectIngeniero)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opciones).toContain("Maria Lopez");
    expect(opciones).not.toContain("Juan Perez");
    expect(opciones).toContain("➕ Ver ingenieros de otras sucursales…");
  });

  it("al elegir un ingeniero, se avisa cuál es su sucursal (onSucursal)", async () => {
    const onSucursal = vi.fn();
    const onIngeniero = vi.fn();
    const { rerender } = render(
      <SelectorIngenieroSucursal
        ingenieros={ingenieros}
        sucursal=""
        ingenieroId=""
        onSucursal={onSucursal}
        onIngeniero={onIngeniero}
      />,
    );
    const [, selectIngeniero] = selects();
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(selectIngeniero, { target: { value: "i2" } });

    expect(onIngeniero).toHaveBeenCalledWith("i2");
    expect(onSucursal).toHaveBeenCalledWith("Tuxtla");

    // El padre (componente controlado) actualiza `sucursal`; simula el re-render.
    rerender(
      <SelectorIngenieroSucursal
        ingenieros={ingenieros}
        sucursal="Tuxtla"
        ingenieroId="i2"
        onSucursal={onSucursal}
        onIngeniero={onIngeniero}
      />,
    );
    expect(screen.getByText("Maria Lopez")).toBeInTheDocument();
  });
});
