/**
 * `@panel` es la ranura paralela que intercepta `/tablero/[ordenId]` cuando
 * se navega ahí desde la lista (ver `@panel/(.)[ordenId]`). Vacía por
 * defecto (`@panel/default.tsx`) — `children` ocupa todo el ancho.
 */
export default function TableroLayout({
  children,
  panel,
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
}) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
