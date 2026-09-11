"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parsearReporteLexmark } from "@/lib/importar/lexmark";
import { boton, botonSec } from "@/lib/ui";
import { Pegar } from "@/lib/iconos";
import Modal from "@/components/Modal";

type Resultado = {
  tipo: string;
  total_en_texto: number;
  insertadas: number;
  omitidas_duplicadas: number;
  filas_ignoradas: number;
};

export default function ModalPegarWOSR() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const preview = texto.trim() ? parsearReporteLexmark(texto) : null;

  function cerrar() {
    setAbierto(false);
    setTexto("");
    setError(null);
    setResultado(null);
    setEnviando(false);
  }

  async function importar() {
    setEnviando(true);
    setError(null);
    setResultado(null);
    try {
      const r = await fetch("/api/importar/lexmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error ?? "No se pudo importar.");
      } else {
        setResultado({
          tipo: data.tipo,
          total_en_texto: data.total_en_texto,
          insertadas: data.insertadas,
          omitidas_duplicadas: data.omitidas_duplicadas,
          filas_ignoradas: data.filas_ignoradas ?? 0,
        });
        router.refresh();
      }
    } catch {
      setError("Error de red al importar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={botonSec + " inline-flex items-center gap-1.5"}
      >
        <Pegar className="h-3.5 w-3.5" />
        Pegar WO/SR
      </button>

      {abierto && (
        <Modal titulo="Importar reporte WO/SR" ancho="max-w-2xl" onClose={cerrar}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand">
                Importar reporte WO/SR
              </h2>
              <button
                type="button"
                onClick={cerrar}
                className="text-sm text-muted hover:text-text"
              >
                Cerrar
              </button>
            </div>

            <p className="text-xs text-muted">
              Pega las filas del reporte tal cual (con o sin encabezados). Cada
              fila se clasifica sola: número de 8 dígitos = WO, número{" "}
              <span className="font-mono">1-…</span> = proactiva/SR.
            </p>

            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={8}
              placeholder="12218288&#9;Break/Fix Repair&#9;N/A&#9;74648460212HC&#9;…"
              className="w-full rounded-lg border border-border-default bg-surface p-2 font-mono text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />

            {/* Vista previa */}
            {preview && !preview.ok && (
              <p className="text-sm text-danger">{preview.error}</p>
            )}
            {preview && preview.ok && (
              <div className="rounded-lg border border-border-default bg-surface-2 p-2 text-xs">
                <p className="mb-1 font-semibold">
                  Detectado: {preview.origen} · {preview.filas.length} orden(es)
                  {preview.ignoradas > 0 &&
                    ` · ${preview.ignoradas} fila(s) ignorada(s)`}
                </p>
                <ul className="space-y-0.5 text-muted">
                  {preview.filas.slice(0, 5).map((f) => (
                    <li key={f.numero_orden} className="truncate">
                      <span className="font-mono">{f.numero_orden}</span> —{" "}
                      {f.cliente || "(sin cliente)"} — {f.modelo || "(sin modelo)"}
                    </li>
                  ))}
                  {preview.filas.length > 5 && (
                    <li>… y {preview.filas.length - 5} más</li>
                  )}
                </ul>
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
            {resultado && (
              <p className="text-sm text-success">
                {resultado.tipo}: {resultado.insertadas} importada(s),{" "}
                {resultado.omitidas_duplicadas} omitida(s) por duplicado
                {resultado.filas_ignoradas > 0 &&
                  `, ${resultado.filas_ignoradas} ignorada(s)`}{" "}
                (de {resultado.total_en_texto}).
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={cerrar} className={botonSec}>
                {resultado ? "Listo" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={importar}
                disabled={enviando || !preview?.ok || !!resultado}
                className={boton}
              >
                {enviando ? "Importando…" : "Importar"}
              </button>
            </div>
        </Modal>
      )}
    </>
  );
}
