"use client";

import { Doughnut } from "react-chartjs-2";
import { Chart, DoughnutController, ArcElement, Tooltip } from "chart.js";
import type { Fase } from "@/lib/panel/datos";
import { varTonoEstatus } from "@/lib/tema";
import { useTokens } from "@/components/panel/widgets/tokens";

Chart.register(DoughnutController, ArcElement, Tooltip);

export default function GraficoFases({ datos }: { datos: Fase[] }) {
  const variables = ["--surface", "--muted", "--text"];
  for (const d of datos ?? []) variables.push(varTonoEstatus(d.estatus));
  const t = useTokens(variables);

  if (!datos || datos.length === 0) {
    return (
      <p className="grid h-full place-items-center text-sm text-muted">
        Sin órdenes activas
      </p>
    );
  }

  const total = datos.reduce((s, d) => s + d.n, 0);
  // Mismos colores que el resto de la app (los chips de estatus del Tablero),
  // no una paleta genérica — así "Asignado" siempre se ve del mismo color.
  const color = (estatus: string) => t[varTonoEstatus(estatus)] || "#94a3b8";

  return (
    <div className="flex h-full min-h-0 items-center gap-3">
      <div className="relative h-full min-h-0 w-1/2 shrink-0">
        <Doughnut
          data={{
            labels: datos.map((d) => d.estatus),
            datasets: [
              {
                data: datos.map((d) => d.n),
                backgroundColor: datos.map((d) => color(d.estatus)),
                borderColor: t["--surface"] || "#ffffff",
                borderWidth: 2,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            cutout: "62%",
            plugins: { legend: { display: false } },
          }}
        />
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-auto text-xs">
        {datos.map((d) => (
          <li key={d.estatus} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: color(d.estatus) }}
            />
            <span className="min-w-0 flex-1 truncate text-text">{d.estatus}</span>
            <b className="tabular-nums text-muted">{d.n}</b>
          </li>
        ))}
        <li className="mt-1 border-t border-border-default pt-1 text-[11px] text-muted">
          {total} activas
        </li>
      </ul>
    </div>
  );
}
