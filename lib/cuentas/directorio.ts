import type { SupabaseClient } from "@supabase/supabase-js";

/** Normaliza un nombre de cuenta para emparejar (quita razón social, acentos…). */
export function normalizarNombreCuenta(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[.,()"'/\-–]/g, " ")
    .replace(/&/g, " AND ")
    .replace(/\bS\s*A\s*B?\b/g, " ")
    .replace(/\bDE\s*C\s*V\b/g, " ")
    .replace(/\bS\s*DE\s*R\s*L\b/g, " ")
    .replace(/\bS\s*R\s*L\b/g, " ")
    .replace(/\b(DE|LA|EL|Y|INC|CO|COMPANY|LIMITED|GRUPO|FINANCIERO)\b/g, " ")
    .replace(/\d/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const ETIQUETA_ROL_CONTACTO: Record<string, string> = {
  mesa: "Mesa de servicio",
  lider: "Líder",
  principal: "Contacto principal",
  secundario: "Contacto secundario",
  escalacion: "Escalación",
  copia: "En copia",
  otro: "Contacto",
};

const ORDEN_ROL: Record<string, number> = {
  mesa: 0, lider: 1, principal: 2, secundario: 3, escalacion: 4, otro: 5, copia: 6,
};

export type ContactoCuenta = {
  id: string;
  nombre: string | null;
  rol_contacto: string | null;
  correo: string | null;
  telefono: string | null;
  notas: string | null;
};

export type ContratoResumen = {
  id: string;
  tipo_contrato: string;
  subtipo_tym: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  visitas_incluidas: number | null;
  equipo_id: string | null;
};

export const ETIQUETA_TIPO_CONTRATO: Record<string, string> = {
  garantia: "Garantía",
  poliza: "Póliza",
  renta: "Renta",
  tym: "TyM",
  instalacion: "Instalación",
  garantia_consumible: "Garantía de consumible",
};

export const ETIQUETA_SUBTIPO_TYM: Record<string, string> = {
  mo: "MO",
  ip: "IP",
  instalacion: "Instalación",
};

/**
 * "Modo aprendizaje": garantía/póliza/renta son ventanas de cobertura que se
 * capturan antes de tener el vencimiento real — hasta que una persona las
 * valide con `fecha_fin`, NO cuentan como dato vigente (decisión del
 * usuario, 2026-09-11). TyM y los servicios de ejecutivo no son ventanas de
 * cobertura, así que null en `fecha_fin` sigue significando "sin vencimiento".
 */
const TIPOS_REQUIEREN_FECHA_FIN = new Set(["garantia", "poliza", "renta"]);

function contratoVigente(c: { tipo_contrato: string; fecha_fin: string | null }, hoy: string): boolean {
  if (TIPOS_REQUIEREN_FECHA_FIN.has(c.tipo_contrato)) {
    return !!c.fecha_fin && c.fecha_fin >= hoy;
  }
  return !c.fecha_fin || c.fecha_fin >= hoy;
}

export type CuentaDirectorio = {
  id: string;
  nombre: string;
  tipo: string | null;
  indicaciones: string | null;
  contactos: ContactoCuenta[];
  /** Contratos activos y vigentes (garantía/póliza/TyM) de este cliente. */
  contratos: ContratoResumen[];
};

/**
 * Encuentra la cuenta Lexmark que corresponde a un nombre de cliente de una
 * orden (emparejamiento difuso por nombre normalizado) y trae sus contactos.
 */
export async function cuentaDeOrden(
  supabase: SupabaseClient,
  cliente: string | null | undefined,
): Promise<CuentaDirectorio | null> {
  const objetivo = normalizarNombreCuenta(cliente);
  if (objetivo.length < 3) return null;

  const { data: cuentas } = await supabase
    .from("clientes")
    .select("id, nombre, tipo, indicaciones");
  if (!cuentas || cuentas.length === 0) return null;

  let mejor: (typeof cuentas)[number] | null = null;
  let mejorPuntaje = 0;
  for (const c of cuentas) {
    const n = normalizarNombreCuenta(c.nombre as string);
    if (!n) continue;
    let p = 0;
    if (n === objetivo) p = 100;
    else if (objetivo.startsWith(n) || n.startsWith(objetivo)) p = 80;
    else if (objetivo.includes(n) || n.includes(objetivo)) p = 60;
    else {
      const a = new Set(n.split(" "));
      const comun = objetivo.split(" ").filter((w) => w.length > 2 && a.has(w)).length;
      p = comun >= 2 ? 30 + comun * 5 : 0;
    }
    if (p > mejorPuntaje) {
      mejorPuntaje = p;
      mejor = c;
    }
  }
  if (!mejor || mejorPuntaje < 55) return null;

  const hoy = new Date().toISOString().slice(0, 10);
  const [{ data: contactos }, { data: contratos }] = await Promise.all([
    supabase
      .from("contactos_cuenta")
      .select("id, nombre, rol_contacto, correo, telefono, notas")
      .eq("cuenta_id", mejor.id)
      .eq("activo", true),
    supabase
      .from("contratos")
      .select("id, tipo_contrato, subtipo_tym, fecha_inicio, fecha_fin, visitas_incluidas, equipo_id")
      .eq("cliente_id", mejor.id)
      .eq("activo", true),
  ]);
  const contratosVigentes = ((contratos ?? []) as ContratoResumen[]).filter((c) =>
    contratoVigente(c, hoy),
  );

  const orden = (contactos ?? []).slice().sort(
    (a, b) =>
      (ORDEN_ROL[a.rol_contacto ?? "otro"] ?? 5) -
      (ORDEN_ROL[b.rol_contacto ?? "otro"] ?? 5),
  );

  return {
    id: mejor.id as string,
    nombre: mejor.nombre as string,
    tipo: (mejor.tipo as string | null) ?? null,
    indicaciones: (mejor.indicaciones as string | null) ?? null,
    contactos: orden as ContactoCuenta[],
    contratos: contratosVigentes,
  };
}
