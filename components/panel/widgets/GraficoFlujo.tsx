"use client";

import { Bar } from "react-chartjs-2";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import type { PuntoFlujo } from "@/lib/panel/datos";
import { useTokens } from "@/components/panel/widgets/tokens";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function GraficoFlujo({ datos }: { datos: PuntoFlujo[] }) {
  const t = useTokens(["--brand", "--surface-2", "--muted", "--border"]);

  if (!datos || datos.length === 0) {
    return (
      <p className="grid h-full place-items-center text-sm text-muted">
        Sin datos del periodo
      </p>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full">
      <Bar
        data={{
          labels: datos.map((d) => d.dia),
          datasets: [
            {
              label: "Proyectadas",
              data: datos.map((d) => d.proyectadas),
              backgroundColor: t["--surface-2"] || "#e2e8f0",
              borderColor: t["--border"] || "#cbd5e1",
              borderWidth: 1,
              borderRadius: 4,
            },
            {
              label: "Completadas",
              data: datos.map((d) => d.completadas),
              backgroundColor: t["--brand"] || "#203f7e",
              borderRadius: 4,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                boxWidth: 10,
                boxHeight: 10,
                usePointStyle: true,
                color: t["--muted"] || "#64748b",
                font: { size: 11 },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: t["--muted"] || "#64748b", font: { size: 11 } },
            },
            y: {
              beginAtZero: true,
              grid: { color: t["--border"] || "#e5e7eb" },
              ticks: {
                color: t["--muted"] || "#64748b",
                precision: 0,
                font: { size: 10 },
              },
              border: { display: false },
            },
          },
        }}
      />
    </div>
  );
}
