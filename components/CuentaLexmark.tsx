import {
  ETIQUETA_ROL_CONTACTO,
  ETIQUETA_TIPO_CONTRATO,
  ETIQUETA_SUBTIPO_TYM,
  type CuentaDirectorio,
} from "@/lib/cuentas/directorio";

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Primer correo / teléfono cuando el campo trae varios separados por / ; // , */
function primero(v: string | null): string | null {
  if (!v) return null;
  return v.split(/\s*(?:\/\/|\/|;|,|-)\s*/)[0].trim() || null;
}
const soloDigitos = (t: string) => t.replace(/\D/g, "");

/**
 * Ficha de la cuenta Lexmark de un cliente: requisitos de acceso + mesa de
 * servicio y contactos. Presentacional; sirve para coordinación y para campo.
 */
export default function CuentaLexmark({
  cuenta,
  compacto = false,
}: {
  cuenta: CuentaDirectorio;
  compacto?: boolean;
}) {
  return (
    <div className="space-y-3">
      {cuenta.contratos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cuenta.contratos.map((c) => (
            <span
              key={c.id}
              className="rounded-full bg-tone-ok-bg px-2.5 py-1 text-[11px] font-extrabold text-tone-ok-fg"
              title={
                c.visitas_incluidas != null
                  ? `${c.visitas_incluidas} visita(s) incluida(s)`
                  : "Visitas ilimitadas"
              }
            >
              {ETIQUETA_TIPO_CONTRATO[c.tipo_contrato] ?? c.tipo_contrato}
              {c.subtipo_tym ? ` (${ETIQUETA_SUBTIPO_TYM[c.subtipo_tym] ?? c.subtipo_tym})` : ""}
              {c.fecha_fin ? ` · hasta ${fechaCorta(c.fecha_fin)}` : " · indefinida"}
            </span>
          ))}
        </div>
      )}

      {cuenta.indicaciones && (
        <div className="rounded-xl border border-tone-warn-fg/25 bg-tone-warn-bg px-3 py-2 text-sm text-tone-warn-fg">
          <p className="text-[11px] font-black uppercase tracking-wide">
            Requisitos de la cuenta
          </p>
          <p className="mt-0.5 whitespace-pre-wrap font-medium">
            {cuenta.indicaciones}
          </p>
        </div>
      )}

      {cuenta.contactos.length === 0 ? (
        <p className="text-xs text-muted">
          Sin contactos registrados para «{cuenta.nombre}».
        </p>
      ) : (
        <ul className="space-y-2">
          {cuenta.contactos.map((c) => {
            const correo = primero(c.correo);
            const tel = c.telefono ? soloDigitos(primero(c.telefono) ?? "") : "";
            const esMesa = c.rol_contacto === "mesa";
            return (
              <li
                key={c.id}
                className={
                  "rounded-xl border px-3 py-2 " +
                  (esMesa
                    ? "border-brand/30 bg-brand-050"
                    : "border-border-default bg-surface-2/40")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-text">
                      {c.nombre ?? correo ?? "Contacto"}
                    </span>
                    <span className="block text-[11px] font-semibold text-muted">
                      {ETIQUETA_ROL_CONTACTO[c.rol_contacto ?? "otro"] ??
                        "Contacto"}
                      {c.notas ? ` · ${c.notas}` : ""}
                    </span>
                  </span>
                </div>
                {!compacto && (correo || tel) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {tel && (
                      <>
                        <a
                          href={`tel:${tel}`}
                          className="rounded-md bg-surface px-2 py-1 text-[11px] font-bold text-brand ring-1 ring-border-default"
                        >
                          Llamar
                        </a>
                        <a
                          href={`https://wa.me/${tel.length === 10 ? "52" + tel : tel}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md bg-surface px-2 py-1 text-[11px] font-bold text-brand ring-1 ring-border-default"
                        >
                          WhatsApp
                        </a>
                      </>
                    )}
                    {correo && (
                      <a
                        href={`mailto:${correo}`}
                        className="max-w-[12rem] truncate rounded-md bg-surface px-2 py-1 text-[11px] font-semibold text-muted ring-1 ring-border-default"
                      >
                        {correo}
                      </a>
                    )}
                  </div>
                )}
                {compacto && correo && (
                  <p className="mt-0.5 truncate text-[11px] text-muted">{correo}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
