import type { SupabaseClient } from "@supabase/supabase-js";
import type { Perfil } from "@/lib/auth/sesion";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { hoyMx, isoMx } from "@/lib/fechas";
import { resumenInicio, type ResumenInicio } from "@/lib/inicio/datos";

export type SeveridadAlerta = "critica" | "alta" | "media";
export type Alerta = {
  severidad: SeveridadAlerta;
  titulo: string;
  detalle: string;
  href: string;
};

export type PuntoFlujo = { dia: string; proyectadas: number; completadas: number };
export type Fase = { estatus: string; n: number };

export type DatosPanel = {
  base: ResumenInicio;
  flujo: PuntoFlujo[];
  fases: Fase[];
  /** % de órdenes concluidas en los últimos 7 días que cerraron en o antes de su ETA. */
  cumplimientoEta: number | null;
  alertas: Alerta[];
};

const CERRADAS = "(Concluido,Cancelado)";
const DIAS_PIEZA_DETENIDA = 7;

/** Etiqueta corta de día ("lun", "mar", …) para una fecha ISO. */
function etiquetaDia(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getDay()];
}

/** Las últimas `n` fechas ISO (incluye hoy), de más antigua a más reciente. */
function ultimosDias(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(isoMx(new Date(Date.now() - i * 864e5)));
  }
  return out;
}

/** Carga todo lo que necesita el panel. Reutiliza `resumenInicio` para lo común. */
export async function cargarDatosPanel(
  supabase: SupabaseClient,
  perfil: Perfil,
): Promise<DatosPanel> {
  const [base, extra] = await Promise.all([
    resumenInicio(supabase, perfil),
    consultasPanel(supabase, perfil),
  ]);
  return { base, ...extra };
}

async function consultasPanel(supabase: SupabaseClient, perfil: Perfil) {
  const hoy = hoyMx();
  const veTodo = esRolQueVeTodo(perfil.rol);
  const zona: Record<string, string> =
    !veTodo && perfil.zona_id ? { zona_id: perfil.zona_id } : {};

  const dias = ultimosDias(6);
  const desde = dias[0];
  const hace7 = new Date(Date.now() - 7 * 864e5).toISOString();

  const [proyRaw, compRaw, fasesRaw, etaRaw, slaRaw, reagRaw, piezaRaw] =
    await Promise.all([
      // Flujo — proyectadas: órdenes con ETA en la ventana
      supabase
        .from("ordenes")
        .select("fecha_eta")
        .match(zona)
        .gte("fecha_eta", desde)
        .lte("fecha_eta", hoy),
      // Flujo — completadas: concluidas actualizadas en la ventana
      supabase
        .from("ordenes")
        .select("actualizado_en")
        .match(zona)
        .eq("estatus", "Concluido")
        .gte("actualizado_en", `${desde}T00:00:00`),
      // Distribución por fase — órdenes activas
      supabase
        .from("ordenes")
        .select("estatus")
        .match(zona)
        .not("estatus", "in", CERRADAS),
      // Cumplimiento de ETA — concluidas últimos 7 días
      supabase
        .from("ordenes")
        .select("fecha_eta, actualizado_en")
        .match(zona)
        .eq("estatus", "Concluido")
        .gte("actualizado_en", hace7)
        .not("fecha_eta", "is", null),
      // Alerta SLA — activas con ETA vencida
      supabase
        .from("ordenes")
        .select("id, numero_orden, cliente, fecha_eta")
        .match(zona)
        .not("estatus", "in", CERRADAS)
        .lt("fecha_eta", hoy)
        .order("fecha_eta", { ascending: true })
        .limit(5),
      // Alerta reagendo sin confirmar
      supabase
        .from("ordenes")
        .select("id, numero_orden, cliente")
        .match(zona)
        .eq("estatus", "Reagendado")
        .order("actualizado_en", { ascending: true })
        .limit(5),
      // Alerta pieza detenida
      supabase
        .from("piezas_orden")
        .select("numero_parte, orden_id, creada_en")
        .eq("estado", "en_espera")
        .order("creada_en", { ascending: true })
        .limit(10),
    ]);

  // --- Flujo ---
  const proyPorDia = new Map(dias.map((d) => [d, 0]));
  for (const r of proyRaw.data ?? []) {
    const k = r.fecha_eta as string | null;
    if (k && proyPorDia.has(k)) proyPorDia.set(k, (proyPorDia.get(k) ?? 0) + 1);
  }
  const compPorDia = new Map(dias.map((d) => [d, 0]));
  for (const r of compRaw.data ?? []) {
    const k = isoMx(new Date(r.actualizado_en as string));
    if (compPorDia.has(k)) compPorDia.set(k, (compPorDia.get(k) ?? 0) + 1);
  }
  const flujo: PuntoFlujo[] = dias.map((d) => ({
    dia: etiquetaDia(d),
    proyectadas: proyPorDia.get(d) ?? 0,
    completadas: compPorDia.get(d) ?? 0,
  }));

  // --- Fases ---
  const conteo = new Map<string, number>();
  for (const r of fasesRaw.data ?? []) {
    const k = (r.estatus as string | null) ?? "Sin estatus";
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  const fases: Fase[] = [...conteo.entries()]
    .map(([estatus, n]) => ({ estatus, n }))
    .sort((a, b) => b.n - a.n);

  // --- Cumplimiento de ETA ---
  const filasEta = etaRaw.data ?? [];
  let cumplimientoEta: number | null = null;
  if (filasEta.length > 0) {
    const enTiempo = filasEta.filter((r) => {
      const eta = r.fecha_eta as string;
      const cierre = isoMx(new Date(r.actualizado_en as string));
      return cierre <= eta;
    }).length;
    cumplimientoEta = Math.round((enTiempo / filasEta.length) * 100);
  }

  // --- Alertas ---
  const alertas: Alerta[] = [];
  for (const o of slaRaw.data ?? []) {
    alertas.push({
      severidad: "critica",
      titulo: `ETA vencida · ${o.numero_orden}`,
      detalle: `${o.cliente ?? "Sin cliente"} — venció el ${o.fecha_eta}`,
      href: `/tablero/${o.id}`,
    });
  }
  const limitePieza = Date.now() - DIAS_PIEZA_DETENIDA * 864e5;
  for (const p of piezaRaw.data ?? []) {
    if (new Date(p.creada_en as string).getTime() > limitePieza) continue;
    alertas.push({
      severidad: "alta",
      titulo: `Pieza detenida · ${p.numero_parte}`,
      detalle: `Más de ${DIAS_PIEZA_DETENIDA} días en espera de arribo`,
      href: `/tablero/${p.orden_id}`,
    });
  }
  for (const o of reagRaw.data ?? []) {
    alertas.push({
      severidad: "media",
      titulo: `Reagendo sin confirmar · ${o.numero_orden}`,
      detalle: `${o.cliente ?? "Sin cliente"} — falta confirmar la nueva fecha`,
      href: `/tablero/${o.id}`,
    });
  }

  return { flujo, fases, cumplimientoEta, alertas };
}

/** Lee varias preferencias del usuario. Devuelve `{}` si la tabla aún no existe. */
export async function leerPreferencias(
  supabase: SupabaseClient,
  claves: string[],
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("preferencias_usuario")
    .select("clave, valor")
    .in("clave", claves);

  if (error || !data) return {};
  const out: Record<string, unknown> = {};
  for (const fila of data) out[fila.clave as string] = fila.valor;
  return out;
}
