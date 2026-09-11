"use client";

import { Bar } from "react-chartjs-2";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from "chart.js";
import { useTokens, PALETA } from "@/components/panel/widgets/tokens";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

/** Barra horizontal categórica genérica — tipo de servicio, top ingenieros… */
export default function GraficoBarrasCategoria({
  etiquetas,
  valores,
  sufijo,
}: {
  etiquetas: string[];
  valores: number[];
  /** Ej. "%" para cumplimiento, "" (nada) para conteos. */
  sufijo?: string;
}) {
  const t = useTokens(["--muted", "--border"]);

  if (etiquetas.length === 0) {
    return (
      <p className="grid h-full place-items-center text-sm text-muted">
        Sin datos con los filtros actuales
      </p>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full">
      <Bar
        data={{
          labels: etiquetas,
          datasets: [
            {
              data: valores,
              backgroundColor: etiquetas.map((_, i) => PALETA[i % PALETA.length]),
              borderRadius: 4,
            },
          ],
        }}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.formattedValue}${sufijo ?? ""}`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: t["--border"] || "#e5e7eb" },
              ticks: { color: t["--muted"] || "#64748b", precision: 0, font: { size: 10 } },
              border: { display: false },
            },
            y: {
              grid: { display: false },
              ticks: { color: t["--muted"] || "#64748b", font: { size: 11 } },
            },
          },
        }}
      />
    </div>
  );
}
