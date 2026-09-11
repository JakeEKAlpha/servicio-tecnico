"use client";

import { useRef, useState } from "react";

/** Botón de dictado por voz (Web Speech API). Silencioso si el navegador no lo soporta. */
export default function DictadoVoz({
  onTexto,
}: {
  onTexto: (texto: string) => void;
}) {
  const [escuchando, setEscuchando] = useState(false);
  const recRef = useRef<unknown>(null);

  function toggle() {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        onstart: () => void;
        onend: () => void;
        onerror: () => void;
        onresult: (e: {
          results: ArrayLike<ArrayLike<{ transcript: string }>>;
        }) => void;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: (typeof w)["SpeechRecognition"];
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      alert("Este navegador no soporta dictado por voz.");
      return;
    }
    if (escuchando) {
      (recRef.current as { stop: () => void } | null)?.stop?.();
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "es-MX";
    rec.onstart = () => setEscuchando(true);
    rec.onend = () => setEscuchando(false);
    rec.onerror = () => setEscuchando(false);
    rec.onresult = (e) => {
      const txt = e.results[0]?.[0]?.transcript?.trim();
      if (txt) onTexto(txt);
    };
    rec.start();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={escuchando ? "Detener dictado" : "Dictar por voz"}
      className={
        "absolute bottom-2 right-2 flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold " +
        (escuchando
          ? "bg-danger/15 text-danger"
          : "bg-success/15 text-success")
      }
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
        <path d="M19 11a7 7 0 0 1-14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {escuchando ? "Escuchando…" : "Dictar"}
    </button>
  );
}
