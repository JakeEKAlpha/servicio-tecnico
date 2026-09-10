"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { subirEvidencia, urlEvidencia } from "@/lib/campo/subir-cliente";
import type { Evidencia } from "@/lib/campo/evidencias";

function Miniatura({ ev, onBorrar }: { ev: Evidencia; onBorrar: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const esImg = /\.(jpe?g|png|webp|heic)$/i.test(ev.url);

  useEffect(() => {
    let vivo = true;
    urlEvidencia(ev.url).then((u) => {
      if (vivo) setUrl(u);
    });
    return () => {
      vivo = false;
    };
  }, [ev.url]);

  return (
    <div className="relative shrink-0">
      {esImg && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={ev.nota ?? ev.tipo}
          className="h-16 w-16 rounded-lg border border-border-default object-cover"
        />
      ) : (
        <a
          href={url ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="flex h-16 w-16 items-center justify-center rounded-lg border border-border-default bg-surface-2 text-[10px] font-bold text-muted"
        >
          {ev.url.split(".").pop()?.toUpperCase() ?? "DOC"}
        </a>
      )}
      <button
        type="button"
        onClick={onBorrar}
        aria-label="Quitar"
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-xs font-bold text-white shadow"
      >
        ×
      </button>
    </div>
  );
}

export default function GrupoEvidencia({
  ordenId,
  tipo,
  label,
  multiple,
  soloImagen = true,
  evidencias,
  bloqueado = false,
}: {
  ordenId: string;
  tipo: string;
  label: string;
  multiple: boolean;
  soloImagen?: boolean;
  evidencias: Evidencia[];
  bloqueado?: boolean;
}) {
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mias = evidencias.filter((e) => e.tipo === tipo);
  const lleno = !multiple && mias.length > 0;

  async function onArchivos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    setError(null);
    const lista = multiple ? Array.from(files) : [files[0]];
    for (const f of lista) {
      const r = await subirEvidencia(ordenId, tipo, f);
      if (!r.ok) {
        setError(r.error);
        break;
      }
    }
    setSubiendo(false);
    router.refresh();
  }

  async function borrar(id: string) {
    await fetch(`/api/campo/${ordenId}/evidencia?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border-default bg-surface-2/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-[#004B25]">{label}</span>
        <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-muted">
          {mias.length}
        </span>
      </div>

      {mias.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {mias.map((ev) => (
            <Miniatura key={ev.id} ev={ev} onBorrar={() => borrar(ev.id)} />
          ))}
        </div>
      )}

      {!bloqueado && !lleno && (
        <label
          className={
            "flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#00A859]/60 bg-[#00A859]/5 px-3 py-3 text-xs font-bold text-[#004B25] transition-colors hover:bg-[#00A859]/10 " +
            (subiendo ? "pointer-events-none opacity-60" : "")
          }
        >
          {subiendo ? "Subiendo…" : soloImagen ? "Tomar / subir foto" : "Adjuntar archivo"}
          <input
            type="file"
            className="hidden"
            multiple={multiple}
            accept={soloImagen ? "image/*" : undefined}
            capture={soloImagen ? "environment" : undefined}
            onChange={(e) => onArchivos(e.target.files)}
          />
        </label>
      )}

      {error && <p className="mt-1.5 text-[11px] font-semibold text-danger">{error}</p>}
    </div>
  );
}
