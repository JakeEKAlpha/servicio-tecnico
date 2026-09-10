import LogoAlpha from "@/components/LogoAlpha";
import LogoBaja from "@/components/LogoBaja";
import type { Empresa } from "@/lib/empresa";

/** Muestra el logo de la empresa operadora (Alpha o Baja) según la zona. */
export default function MarcaEmpresa({
  empresa,
  variante = "blanco",
  className = "h-7 w-auto",
}: {
  empresa: Empresa;
  variante?: "color" | "blanco";
  className?: string;
}) {
  return empresa.clave === "baja" ? (
    <LogoBaja variante={variante} className={className} />
  ) : (
    <LogoAlpha variante={variante} className={className} />
  );
}
