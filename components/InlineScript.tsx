/**
 * Script en línea que corre mientras el navegador parsea el HTML (antes del
 * primer pintado). En el cliente se marca como `text/plain` para que React no
 * lo vuelva a ejecutar ni se queje. Ver la guía de Next
 * "Preventing Flash before Hydration".
 */
export default function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
