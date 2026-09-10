"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Interruptor Panel ⇄ Simple. Guarda la preferencia y refresca la página. */
export default function ToggleVista({ actual }: { actual: "panel" | "simple" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [guardando, setGuardando] = useState(false);

  async function cambiar(a: "panel" | "simple") {
    if (a === actual || guardando) return;
    setGuardando(true);
    try {
      const r = await fetch("/api/preferencias", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clave: "inicio_vista", valor: a }),
      });
      if (!r.ok) throw new Error();
      start(() => router.refresh());
    } catch {
      setGuardando(false);
    }
  }

  return (
    <div
      className="inline-flex rounded-lg border border-border-default bg-surface-2 p-0.5 text-xs font-bold"
      role="group"
      aria-label="Tipo de vista"
    >
      {(["panel", "simple"] as const).map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => cambiar(a)}
          disabled={guardando || pending}
          aria-pressed={actual === a}
          className={
            "rounded-md px-2.5 py-1 transition-colors disabled:opacity-60 " +
            (actual === a
              ? "bg-surface text-brand shadow-sm"
              : "text-muted hover:text-text")
          }
        >
          {a === "panel" ? "Panel" : "Simple"}
        </button>
      ))}
    </div>
  );
}
