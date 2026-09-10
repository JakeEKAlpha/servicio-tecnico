import IconoAD from "@/components/IconoAD";

/**
 * Pantalla de arranque — se muestra mientras carga la primera vista.
 * Identidad "Servicio Técnico" (azul Alpha) con el monograma de Alpha Digital.
 */
export default function Loading() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-10 px-6 text-white"
      style={{ background: "#203F7E" }}
    >
      <IconoAD className="h-28 w-auto animate-pulse sm:h-36" />
      <div className="text-center leading-tight">
        <p className="text-lg font-bold sm:text-xl">Lexmark</p>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/85 sm:text-base">
          Servicio técnico by
        </p>
        <p className="mt-1 text-2xl font-extrabold sm:text-3xl">
          Alpha Digital<span className="align-super text-xs">®</span>
        </p>
      </div>
    </div>
  );
}
