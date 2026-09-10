import type { CSSProperties, ReactNode } from "react";

/**
 * Entrada suave de un bloque: fade + subida de 14px con ease-out
 * (cubic-bezier(0.16,1,0.3,1)), ~460 ms. Se anima al pintar, sin JS ni
 * salto de contenido. `delay` en ms escalona varios elementos.
 * Con `prefers-reduced-motion` el CSS global anula la animación.
 */
export default function Revelar({
  children,
  delay = 0,
  className = "",
  style,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={"anim-reveal " + className}
      style={delay ? { ...style, animationDelay: `${delay}ms` } : style}
    >
      {children}
    </div>
  );
}
