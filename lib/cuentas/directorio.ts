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

export type ClienteOpcion = { id: string; nombre: string };

export type EquipoOpcion = {
  id: string;
  cliente_id: string | null;
  marca_id: string | null;
  modelo: string;
  serie: string | null;
};

/**
 * Para el selector opcional "Vincular a cliente existente" de
 * `ModalNuevaOrden` (blueprint `cerrar-deuda-datos`). Todos los clientes
 * activos, para elegir uno al crear una orden en vez de depender del
 * fuzzy-match de `cuentaDeOrden()`.
 */
export async function listarClientesOpciones(
  supabase: SupabaseClient,
): Promise<ClienteOpcion[]> {
  const { data } = await supabase
    .from("clientes")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  return (data ?? []) as ClienteOpcion[];
}

/**
 * Todos los equipos activos, para filtrar en el cliente (por cliente_id +
 * marca_id) en el selector de equipo de `ModalNuevaOrden`. La tabla es
 * pequeña (hoy vacía en producción — ver blueprint), así que traerla completa
 * y filtrar en el componente evita una ruta de API nueva.
 */
export async function listarEquiposOpciones(
  supabase: SupabaseClient,
): Promise<EquipoOpcion[]> {
  const { data } = await supabase
    .from("equipos")
    .select("id, cliente_id, marca_id, modelo, serie")
    .eq("activo", true)
    .order("modelo");
  return (data ?? []) as EquipoOpcion[];
}

/** Trae contactos activos + contratos vigentes de una cuenta ya identificada. */
async function contactosYContratosDe(
  supabase: SupabaseClient,
  clienteId: string,
): Promise<Pick<CuentaDirectorio, "contactos" | "contratos">> {
  const hoy = new Date().toISOString().slice(0, 10);
  const [{ data: contactos }, { data: contratos }] = await Promise.all([
    supabase
      .from("contactos_cuenta")
      .select("id, nombre, rol_contacto, correo, telefono, notas")
      .eq("cuenta_id", clienteId)
      .eq("activo", true),
    supabase
      .from("contratos")
      .select("id, tipo_contrato, subtipo_tym, fecha_inicio, fecha_fin, visitas_incluidas, equipo_id")
      .eq("cliente_id", clienteId)
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
  return { contactos: orden as ContactoCuenta[], contratos: contratosVigentes };
}

/**
 * Resuelve una cuenta por id directo — el camino rápido cuando
 * `ordenes.cliente_id` ya está poblado (selector en creación, o backfill).
 * `null` si el id no existe (cuenta borrada) o está inactiva.
 */
async function cuentaPorId(
  supabase: SupabaseClient,
  clienteId: string,
): Promise<CuentaDirectorio | null> {
  const { data: c } = await supabase
    .from("clientes")
    .select("id, nombre, tipo, indicaciones")
    .eq("id", clienteId)
    .eq("activo", true)
    .maybeSingle();
  if (!c) return null;

  const { contactos, contratos } = await contactosYContratosDe(supabase, c.id as string);
  return {
    id: c.id as string,
    nombre: c.nombre as string,
    tipo: (c.tipo as string | null) ?? null,
    indicaciones: (c.indicaciones as string | null) ?? null,
    contactos,
    contratos,
  };
}

/**
 * Encuentra la cuenta que corresponde a una orden y trae sus contactos. Si
 * `clienteId` viene (porque la orden ya tiene `cliente_id` poblado —
 * selector en creación, o backfill), se resuelve por id directo, sin loop de
 * puntaje. Si no viene o no se encuentra, cae al emparejamiento difuso por
 * nombre normalizado de siempre — comportamiento sin cambios para cualquier
 * llamador que no pase `clienteId` (p. ej. `/campo`, que sigue llamando esta
 * función con 2 argumentos, sin tocarse).
 */
export async function cuentaDeOrden(
  supabase: SupabaseClient,
  cliente: string | null | undefined,
  clienteId?: string | null,
): Promise<CuentaDirectorio | null> {
  if (clienteId) {
    const porId = await cuentaPorId(supabase, clienteId);
    if (porId) return porId;
  }

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

  const { contactos, contratos } = await contactosYContratosDe(supabase, mejor.id as string);
  return {
    id: mejor.id as string,
    nombre: mejor.nombre as string,
    tipo: (mejor.tipo as string | null) ?? null,
    indicaciones: (mejor.indicaciones as string | null) ?? null,
    contactos,
    contratos,
  };
}

/**
 * La misma lógica de puntaje que `cuentaDeOrden`, pero pura (sin
 * `SupabaseClient`) — para el script de backfill (Paso 2 del blueprint
 * `cerrar-deuda-datos`), que ya tiene la lista de clientes cargada y no
 * necesita re-consultar Supabase por cada orden.
 */
export function mejorCoincidenciaCliente(
  clientes: { id: string; nombre: string }[],
  nombreObjetivo: string | null | undefined,
): { id: string; puntaje: number } | null {
  const objetivo = normalizarNombreCuenta(nombreObjetivo);
  if (objetivo.length < 3) return null;

  let mejor: { id: string; nombre: string } | null = null;
  let mejorPuntaje = 0;
  for (const c of clientes) {
    const n = normalizarNombreCuenta(c.nombre);
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
  return { id: mejor.id, puntaje: mejorPuntaje };
}
