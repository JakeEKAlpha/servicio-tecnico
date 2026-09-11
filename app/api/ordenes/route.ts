import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listarOrdenes } from "@/lib/ordenes/listar";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { MARCA_LEXMARK_ID } from "@/lib/marcas";
import { generarDocumento } from "@/lib/documentos/generar";

/**
 * Colección de órdenes.
 *
 *  GET  -> listar órdenes para el Tablero (via lib/ordenes/listar)
 *  POST -> crear una orden nueva a mano
 *          Equivale a `crearOrdenRapida(datos)` de 02_Automatizacion.gs.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Genera un número de orden automático `MAN-yyMMdd-HHmmss`.
 *
 * Equivale a:
 *   "MAN-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyMMdd-HHmmss")
 *
 * El Apps Script usa la zona horaria del proyecto (America/Mexico_City). El
 * servidor de Next.js corre en UTC, así que aquí forzamos esa misma zona
 * horaria para que el número quede idéntico al del sistema viejo.
 */
function generarNumeroManual(fecha: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(fecha);

  const val = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";

  // en-CA con hour12:false devuelve "24" a la medianoche en algunos runtimes.
  let hora = val("hour");
  if (hora === "24") hora = "00";

  return `MAN-${val("year")}${val("month")}${val("day")}-${hora}${val("minute")}${val("second")}`;
}

function limpiar(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

/** "" -> null; texto -> texto recortado. Para columnas de texto opcionales. */
function textoONull(v: unknown): string | null {
  const s = limpiar(v);
  return s === "" ? null : s;
}

/**
 * `datos_especificos` es jsonb libre (igual que en la importación de
 * Lexmark) para guardar datos propios de una marca sin agregar columnas —
 * p. ej. el SR de Xerox u horario laboral. Solo se aceptan pares
 * texto→texto, y vacío se descarta.
 */
function datosEspecificos(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const clave = limpiar(k);
    const valor = limpiar(val);
    if (clave && valor) out[clave] = valor;
  }
  return out;
}

// ---------------------------------------------------------------------------
// GET — listar órdenes para el Tablero (punto 3)
// ---------------------------------------------------------------------------

/**
 * Réplica de la parte de DATOS de `reconstruirVistaGeneral()`:
 *  - select con embed a ingenieros y marcas
 *  - filtrado por zona -> lo hace RLS (coordinador: su zona; gerencia/admin: todo)
 *  - orden: prioridad de estatus ↑, luego numero_visita ↑, luego fecha_eta ↑
 *
 * Query param opcional `?activos=1` -> excluye Concluido y Cancelado
 * (equivale al filtro "Solo activos" del menú).
 */
const VALORES_ACTIVOS = ["1", "true", "si", "sí", "yes"];

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { ok: false, error: "No hay sesión iniciada." },
      { status: 401 },
    );
  }

  const soloActivos = VALORES_ACTIVOS.includes(
    (new URL(request.url).searchParams.get("activos") ?? "").toLowerCase(),
  );

  const { ordenes, error } = await listarOrdenes(supabase, { soloActivos });
  if (error) {
    return NextResponse.json(
      { ok: false, error: "No se pudieron leer las órdenes.", detalle: error },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ordenes });
}

// ---------------------------------------------------------------------------
// POST — crear orden (punto 1)
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1) Sesión
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { ok: false, error: "No hay sesión iniciada." },
      { status: 401 },
    );
  }

  // 2) Perfil del usuario (para saber su zona y su rol)
  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles")
    .select("zona_id, rol")
    .eq("id", user.id)
    .maybeSingle();

  if (perfilError) {
    return NextResponse.json(
      { ok: false, error: "No se pudo leer el perfil del usuario." },
      { status: 500 },
    );
  }
  if (!perfil) {
    return NextResponse.json(
      { ok: false, error: "Tu usuario no tiene un perfil asignado." },
      { status: 403 },
    );
  }

  // 3) Body
  let datos: Record<string, unknown>;
  try {
    datos = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "El cuerpo de la petición no es JSON válido." },
      { status: 400 },
    );
  }

  // 4) Validaciones obligatorias (igual que crearOrdenRapida)
  const cliente = limpiar(datos.cliente);
  const falla = limpiar(datos.falla);
  if (!cliente) {
    return NextResponse.json(
      { ok: false, error: "El cliente es obligatorio." },
      { status: 400 },
    );
  }
  if (!falla) {
    return NextResponse.json(
      { ok: false, error: "Describe la falla o el motivo del servicio." },
      { status: 400 },
    );
  }

  // 5) Zona destino
  //    - coordinador / ingeniero: siempre su propia zona (perfil).
  //    - gerencia / admin: no tienen zona fija, deben mandar `zona_id`.
  const veTodo = esRolQueVeTodo(perfil.rol as string);
  let zonaId = perfil.zona_id as string | null;
  const zonaIdBody = textoONull(datos.zona_id);

  if (veTodo) {
    if (!zonaIdBody) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Como gerencia/admin debes indicar la zona (zona_id) de la orden.",
        },
        { status: 400 },
      );
    }
    zonaId = zonaIdBody;
  } else if (zonaIdBody && zonaIdBody !== zonaId) {
    // Un coordinador no puede crear órdenes en otra zona (RLS también lo
    // bloquearía, pero devolvemos un error claro antes).
    return NextResponse.json(
      { ok: false, error: "No puedes crear órdenes en otra zona." },
      { status: 403 },
    );
  }

  if (!zonaId) {
    return NextResponse.json(
      { ok: false, error: "Tu perfil no tiene una zona asignada." },
      { status: 403 },
    );
  }

  // 6) Marca (default Lexmark)
  const marcaId = textoONull(datos.marca_id) ?? MARCA_LEXMARK_ID;

  // 7) origen: 'SR' | 'WO' -> se respeta; cualquier otra cosa -> 'MANUAL'
  const origen =
    datos.origen === "SR" || datos.origen === "WO" ? datos.origen : "MANUAL";

  // 8) Número de orden (manual o autogenerado)
  let numeroOrden = limpiar(datos.numero_orden);
  if (!numeroOrden) {
    numeroOrden = generarNumeroManual();
  }

  // 9) Campos de asignación
  const fechaEta = textoONull(datos.fecha_eta); // 'YYYY-MM-DD' o null
  const horaEta = textoONull(datos.hora_eta); // texto (soporta rangos) o null
  const ingenieroId = textoONull(datos.ingeniero_id);

  // 10) Estatus inicial: (fecha_eta && ingeniero_id) ? 'Asignado' : 'Nuevo'
  const estatus = fechaEta && ingenieroId ? "Asignado" : "Nuevo";

  // 11) Pre-chequeo de duplicado (misma lógica que getExistingKeys: número +
  //     visita 1, dentro de la zona). El UNIQUE (zona_id, numero_orden,
  //     numero_visita) de la BD es el respaldo real.
  const { data: yaExiste, error: dupError } = await supabase
    .from("ordenes")
    .select("id")
    .eq("zona_id", zonaId)
    .eq("numero_orden", numeroOrden)
    .eq("numero_visita", 1)
    .maybeSingle();

  if (dupError) {
    return NextResponse.json(
      { ok: false, error: "No se pudo verificar si la orden ya existe." },
      { status: 500 },
    );
  }
  if (yaExiste) {
    return NextResponse.json(
      {
        ok: false,
        error: `Ya existe una orden "${numeroOrden}". Usa otro número o déjalo vacío para generar uno automático.`,
      },
      { status: 409 },
    );
  }

  // 12) Insert
  const nuevaOrden = {
    zona_id: zonaId,
    marca_id: marcaId,
    origen,
    numero_orden: numeroOrden,
    numero_visita: 1,
    cliente,
    falla,
    contacto: textoONull(datos.contacto),
    tel_fijo: textoONull(datos.tel_fijo),
    tel_movil: textoONull(datos.tel_movil),
    direccion: textoONull(datos.direccion),
    localidad: textoONull(datos.localidad),
    estado: textoONull(datos.estado),
    modelo: textoONull(datos.modelo),
    serie: textoONull(datos.serie),
    fecha_eta: fechaEta,
    hora_eta: horaEta,
    ingeniero_id: ingenieroId,
    sucursal: textoONull(datos.sucursal),
    // Selector opcional en ModalNuevaOrden (blueprint cerrar-deuda-datos) —
    // null si no se vinculó, igual que hoy hace cualquier caller que no
    // mande estos campos (importador Lexmark/Xerox).
    cliente_id: textoONull(datos.cliente_id),
    equipo_id: textoONull(datos.equipo_id),
    estatus,
    ...(Object.keys(datosEspecificos(datos.datos_especificos)).length > 0
      ? { datos_especificos: datosEspecificos(datos.datos_especificos) }
      : {}),
  };

  const { data: orden, error: insertError } = await supabase
    .from("ordenes")
    .insert(nuevaOrden)
    .select()
    .single();

  if (insertError) {
    // 23505 = unique_violation (choque en el UNIQUE de zona+número+visita).
    if (insertError.code === "23505") {
      return NextResponse.json(
        {
          ok: false,
          error: `Ya existe una orden "${numeroOrden}". Usa otro número o déjalo vacío para generar uno automático.`,
        },
        { status: 409 },
      );
    }
    // 23503 = foreign_key_violation (marca_id / ingeniero_id / zona_id inválido).
    if (insertError.code === "23503") {
      return NextResponse.json(
        { ok: false, error: "Marca, ingeniero o zona no válidos." },
        { status: 400 },
      );
    }
    // 42501 = insufficient_privilege (RLS lo bloqueó).
    if (insertError.code === "42501") {
      return NextResponse.json(
        { ok: false, error: "No tienes permiso para crear esta orden." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "No se pudo crear la orden.", detalle: insertError.message },
      { status: 500 },
    );
  }

  // Si la orden nace "Asignado", generamos el Doc + PDF (como `crearOrdenRapida`).
  // Si falla, la orden YA quedó creada: devolvemos ok con un aviso, no error.
  let linkDoc: string | null = null;
  let linkPdf: string | null = null;
  let avisoDoc: string | undefined;
  if (orden.estatus === "Asignado") {
    try {
      const doc = await generarDocumento(supabase, orden.id as string);
      linkDoc = doc.link_doc;
      linkPdf = doc.link_pdf;
    } catch (e) {
      avisoDoc =
        "La orden se creó pero el documento no se generó: " +
        (e instanceof Error ? e.message : String(e));
      console.error(avisoDoc);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      orden,
      numero_orden: orden.numero_orden,
      estatus: orden.estatus,
      link_doc: linkDoc,
      link_pdf: linkPdf,
      ...(avisoDoc ? { aviso: avisoDoc } : {}),
    },
    { status: 201 },
  );
}
