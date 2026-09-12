import { NextResponse } from "next/server";
import { requerirUsuario, requerirPerfil } from "@/lib/auth/requerirSesion";
import { ESTATUS_ORDEN, ESTATUS_MANUALES } from "@/lib/ordenes/estatus";
import { esRolQueVeTodo } from "@/lib/auth/roles";
import { generarDocumento } from "@/lib/documentos/generar";
import { enviarPushAPerfil } from "@/lib/push/enviar";

/**
 * Una orden concreta (identificada por su `id` uuid).
 *
 *  GET   -> leer una orden (con ingeniero y marca), filtrada por RLS.
 *  PATCH -> cambiar estatus y/o reasignar (fecha ETA + hora + ingeniero + sucursal).
 *           Equivale a `cambiarEstatus()` / `guardarAsignacion()` de
 *           02_Automatizacion.gs.
 *
 * Lo que NO hace este endpoint (lo resuelve la base de datos con triggers):
 *  - Registrar el cambio en `ordenes_historial`  -> trigger `trg_historial`.
 *  - Concluir en cascada todas las visitas de la orden al poner "Concluido"
 *    -> trigger `trg_cascada_concluido`.
 */

// Columnas que se copian tal cual a la nueva visita cuando una orden pasa a
// "Pendiente por partes" (réplica de `motorEstatusYVisitas` del original).
const COLS_COPIA_NUEVA_VISITA = [
  "zona_id",
  "marca_id",
  "origen",
  "numero_orden",
  "cliente",
  "contacto",
  "tel_fijo",
  "tel_movil",
  "direccion",
  "localidad",
  "estado",
  "modelo",
  "serie",
  "falla",
  "sucursal",
  "datos_especificos",
] as const;

function limpiar(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function textoONull(v: unknown): string | null {
  const s = limpiar(v);
  return s === "" ? null : s;
}

// ---------------------------------------------------------------------------
// GET — leer una orden
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const s = await requerirUsuario();
  if (!s.ok) return s.res;
  const { supabase } = s;

  const { data: orden, error } = await supabase
    .from("ordenes")
    .select("*, ingenieros(nombre), marcas(nombre)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "No se pudo leer la orden." },
      { status: 500 },
    );
  }
  if (!orden) {
    return NextResponse.json(
      { ok: false, error: "Orden no encontrada." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, orden });
}

// ---------------------------------------------------------------------------
// PATCH — cambiar estatus / reasignar (punto 2)
// ---------------------------------------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const s = await requerirPerfil();
  if (!s.ok) return s.res;
  const { supabase, perfil } = s;
  const veTodo = esRolQueVeTodo(perfil.rol as string);

  // 1) Body
  let datos: Record<string, unknown>;
  try {
    datos = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "El cuerpo de la petición no es JSON válido." },
      { status: 400 },
    );
  }

  const nuevoEstatus =
    datos.estatus === undefined || datos.estatus === null
      ? null
      : limpiar(datos.estatus);
  const traeAsignacion =
    "fecha_eta" in datos || "hora_eta" in datos || "ingeniero_id" in datos;
  const traeSucursal = "sucursal" in datos;

  // Mover una orden a otra zona: solo gerencia/admin (regla del negocio:
  // "una WO que esté en una zona que no corresponde, moverla").
  const nuevaZona = "zona_id" in datos ? textoONull(datos.zona_id) : undefined;
  if (nuevaZona !== undefined && !veTodo) {
    return NextResponse.json(
      { ok: false, error: "Cambiar la zona de una orden es solo para gerencia." },
      { status: 403 },
    );
  }

  // Edición de datos del detalle (doble clic para editar en la UI).
  const COLS_DETALLE = [
    "cliente",
    "contacto",
    "tel_fijo",
    "tel_movil",
    "direccion",
    "localidad",
    "estado",
    "modelo",
    "serie",
    "falla",
    "comentarios",
    "partes_recomendadas",
  ];
  const detalle =
    datos.detalle && typeof datos.detalle === "object"
      ? (datos.detalle as Record<string, unknown>)
      : null;
  const traeDetalle =
    !!detalle && Object.keys(detalle).some((k) => COLS_DETALLE.includes(k));

  if (
    !nuevoEstatus &&
    !traeAsignacion &&
    !traeSucursal &&
    nuevaZona === undefined &&
    !traeDetalle
  ) {
    return NextResponse.json(
      { ok: false, error: "No mandaste nada que actualizar." },
      { status: 400 },
    );
  }

  // Reasignar (fecha/hora/ingeniero) solo tiene sentido junto con estatus
  // "Asignado" o sin estatus. Cualquier otra combinación es contradictoria
  // (ej. "Reagendado" + ingeniero) y en el original nunca ocurre porque son
  // acciones separadas del Sidebar.
  if (traeAsignacion && nuevoEstatus && nuevoEstatus !== "Asignado") {
    return NextResponse.json(
      {
        ok: false,
        error:
          'No combines un cambio de estatus a "' +
          nuevoEstatus +
          '" con una reasignación de fecha/ingeniero.',
      },
      { status: 400 },
    );
  }

  // 2) Leer la orden actual (RLS decide si el usuario la puede ver/editar)
  const { data: ordenActual, error: readError } = await supabase
    .from("ordenes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json(
      { ok: false, error: "No se pudo leer la orden." },
      { status: 500 },
    );
  }
  if (!ordenActual) {
    return NextResponse.json(
      { ok: false, error: "Orden no encontrada." },
      { status: 404 },
    );
  }

  const estatusActual = String(ordenActual.estatus || "").trim();

  // Guardas comunes (de `cambiarEstatus` y `guardarAsignacion`):
  // orden ya cerrada -> no se modifica desde zona.
  if (estatusActual === "Cancelado" && !veTodo) {
    return NextResponse.json(
      { ok: false, error: "Orden cancelada: ya no se puede modificar." },
      { status: 409 },
    );
  }

  // -----------------------------------------------------------------------
  // Armar el update
  // -----------------------------------------------------------------------
  const update: Record<string, unknown> = {};
  let crearVisitaSiguiente = false;
  let fueAsignacion = false;
  let huboNuevoIngeniero = false;

  if (nuevaZona !== undefined && nuevaZona !== ordenActual.zona_id) {
    update.zona_id = nuevaZona;
  }

  if (traeDetalle && detalle) {
    if (estatusActual === "Concluido" && !veTodo) {
      return NextResponse.json(
        { ok: false, error: "Orden concluida: ya no se puede editar." },
        { status: 409 },
      );
    }
    for (const [k, v] of Object.entries(detalle)) {
      if (COLS_DETALLE.includes(k)) update[k] = textoONull(v);
    }
  }

  if (nuevoEstatus) {
    // --- Flujo "cambiar estatus" (cambiarEstatus) ---
    // Coordinador/ingeniero: solo los 6 de `getEstatusValidos()` (sin Cancelado).
    // Gerencia/admin: cualquiera del enum (incluido Cancelado).
    const listaPermitida: readonly string[] = veTodo
      ? ESTATUS_ORDEN
      : ESTATUS_MANUALES;
    if (nuevoEstatus === "Cancelado" && !veTodo) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cancelar solo está permitido desde el Panel Gerencial.",
        },
        { status: 403 },
      );
    }
    if (!listaPermitida.includes(nuevoEstatus)) {
      return NextResponse.json(
        { ok: false, error: "Estatus no permitido." },
        { status: 400 },
      );
    }
    // Concluido es un candado para coordinador/ingeniero, pero no para
    // gerencia/admin (decisión del usuario, 2026-09-12): puede reabrir una
    // orden que se concluyó por error. Mismo criterio en el bloque de
    // reasignación de abajo y en los de detalle/sucursal más arriba —
    // los 4 comparten `!veTodo` a propósito, no los desincronices.
    if (estatusActual === "Concluido" && nuevoEstatus !== "Concluido" && !veTodo) {
      return NextResponse.json(
        { ok: false, error: "Orden concluida: ya no se puede modificar." },
        { status: 409 },
      );
    }

    update.estatus = nuevoEstatus;

    if (nuevoEstatus === "Reagendado") {
      // Reagendado: borra Fecha/Hora ETA, conserva ingeniero y sucursal.
      update.fecha_eta = null;
      update.hora_eta = null;
    }

    if (nuevoEstatus === "Pendiente por partes") {
      // La visita siguiente solo se crea si la orden YA tuvo asignación
      // (flujo reactivo: el técnico fue, no pudo, pidió partes). Si nunca se
      // asignó (pieza antes de visita / flujo SR), la misma orden se queda
      // esperando la pieza — no se crea otra visita.
      crearVisitaSiguiente =
        ordenActual.ingeniero_id != null || ordenActual.fecha_eta != null;
    }
  }

  if (traeAsignacion || (nuevoEstatus === "Asignado" && traeSucursal)) {
    // --- Flujo "reasignar" (guardarAsignacion, sin validación de ETA por
    //     preferencias — esa parte no está migrada) ---
    if (estatusActual === "Concluido" && !veTodo) {
      return NextResponse.json(
        { ok: false, error: "Orden concluida: ya no se puede modificar." },
        { status: 409 },
      );
    }

    // ingeniero: del body o, si no viene, el que ya tenga la orden.
    const ingenieroId =
      textoONull(datos.ingeniero_id) ??
      (ordenActual.ingeniero_id as string | null);
    // fecha/hora: del body o las que ya tenga la orden.
    const fechaEta =
      "fecha_eta" in datos
        ? textoONull(datos.fecha_eta)
        : (ordenActual.fecha_eta as string | null);
    const horaEta =
      "hora_eta" in datos
        ? textoONull(datos.hora_eta)
        : (ordenActual.hora_eta as string | null);

    if (!ingenieroId) {
      return NextResponse.json(
        { ok: false, error: "Ingeniero es obligatorio para asignar." },
        { status: 400 },
      );
    }
    if (!fechaEta) {
      return NextResponse.json(
        { ok: false, error: "Fecha ETA es obligatoria para asignar." },
        { status: 400 },
      );
    }
    if (!horaEta) {
      return NextResponse.json(
        { ok: false, error: "Hora ETA es obligatoria para asignar." },
        { status: 400 },
      );
    }

    update.ingeniero_id = ingenieroId;
    update.fecha_eta = fechaEta;
    update.hora_eta = horaEta;
    if (traeSucursal) update.sucursal = textoONull(datos.sucursal);
    update.estatus = "Asignado";
    fueAsignacion = true;
    // Distinto de "hubo asignación" (fueAsignacion, que también es true al
    // reprogramar sin cambiar de ingeniero, ej. arrastrar en el Gantt) — el
    // push de "nueva asignación" es solo cuando el ingeniero SÍ cambia.
    huboNuevoIngeniero = ingenieroId !== (ordenActual.ingeniero_id as string | null);
  } else if (traeSucursal && !nuevoEstatus) {
    // Sólo sucursal (ej. desde el popup de "validar pieza sin sucursal"):
    // cuenta como parte de la asignación. El trigger resuelve sucursal_id.
    if (estatusActual === "Concluido" && !veTodo) {
      return NextResponse.json(
        { ok: false, error: "Orden concluida: ya no se puede editar." },
        { status: 409 },
      );
    }
    update.sucursal = textoONull(datos.sucursal);
  }

  // -----------------------------------------------------------------------
  // Aplicar el update
  // -----------------------------------------------------------------------
  const { data: ordenActualizada, error: updateError } = await supabase
    .from("ordenes")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (updateError) {
    if (updateError.code === "42501") {
      return NextResponse.json(
        { ok: false, error: "No tienes permiso para modificar esta orden." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo actualizar la orden.",
        detalle: updateError.message,
      },
      { status: 500 },
    );
  }
  if (!ordenActualizada) {
    // RLS dejó pasar la lectura pero no la escritura, o la fila desapareció.
    return NextResponse.json(
      { ok: false, error: "No tienes permiso para modificar esta orden." },
      { status: 403 },
    );
  }

  // -----------------------------------------------------------------------
  // "Pendiente por partes" -> crear la visita siguiente (réplica de
  // motorEstatusYVisitas). No hay trigger en la BD para esto.
  // -----------------------------------------------------------------------
  let visitaSiguiente: unknown = null;
  if (crearVisitaSiguiente) {
    const visitaActual = Number(ordenActual.numero_visita) || 1;
    const siguienteNum = visitaActual + 1;

    // ¿Ya existe la visita siguiente? (mismo pre-chequeo que getExistingKeys)
    const { data: yaExiste, error: checkErr } = await supabase
      .from("ordenes")
      .select("id")
      .eq("zona_id", ordenActual.zona_id)
      .eq("numero_orden", ordenActual.numero_orden)
      .eq("numero_visita", siguienteNum)
      .maybeSingle();

    if (!checkErr && !yaExiste) {
      const nuevaVisita: Record<string, unknown> = {
        numero_visita: siguienteNum,
        estatus: "Pendiente",
        // fecha/hora/ingeniero/links/partes/comentarios arrancan vacíos
        fecha_eta: null,
        hora_eta: null,
        ingeniero_id: null,
        link_doc: null,
        link_pdf: null,
        partes_recomendadas: null,
        comentarios: null,
      };
      for (const col of COLS_COPIA_NUEVA_VISITA) {
        nuevaVisita[col] = ordenActual[col as keyof typeof ordenActual];
      }

      const { data: creada, error: crearErr } = await supabase
        .from("ordenes")
        .insert(nuevaVisita)
        .select()
        .maybeSingle();

      if (crearErr) {
        // La orden ya quedó en "Pendiente por partes"; solo falló la visita
        // nueva. Lo reportamos sin tumbar la respuesta.
        return NextResponse.json({
          ok: true,
          orden: ordenActualizada,
          visita_siguiente: null,
          aviso:
            "La orden quedó en 'Pendiente por partes' pero no se pudo crear la visita siguiente: " +
            crearErr.message,
        });
      }
      visitaSiguiente = creada;
    }
  }

  // Si esta llamada asignó la orden, generamos el Doc + PDF (como
  // `guardarAsignacion`). Si falla, la asignación YA quedó guardada:
  // devolvemos ok con un aviso, no error.
  let linkDoc = ordenActualizada.link_doc as string | null;
  let linkPdf = ordenActualizada.link_pdf as string | null;
  let avisoDoc: string | undefined;
  // `regenerar_doc: false` -> reprogramación rápida (Gantt): mueve la orden sin
  // regenerar el PDF.
  const regenerarDoc = datos.regenerar_doc !== false;
  if (fueAsignacion && regenerarDoc) {
    try {
      const doc = await generarDocumento(supabase, id);
      linkDoc = doc.link_doc;
      linkPdf = doc.link_pdf;
    } catch (e) {
      avisoDoc =
        "La orden quedó asignada pero el documento no se generó: " +
        (e instanceof Error ? e.message : String(e));
      console.error(avisoDoc);
    }
  }

  // Push al ingeniero recién asignado — no a un reagendado con el mismo
  // ingeniero (ver huboNuevoIngeniero más arriba). Un error de push no debe
  // tumbar la respuesta: la asignación ya quedó guardada.
  if (huboNuevoIngeniero && ordenActualizada.ingeniero_id) {
    try {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("id")
        .eq("ingeniero_id", ordenActualizada.ingeniero_id)
        .maybeSingle();
      if (perfil) {
        await enviarPushAPerfil(supabase, perfil.id, {
          titulo: "Nueva asignación",
          cuerpo: `Orden ${ordenActualizada.numero_orden} · ${ordenActualizada.cliente ?? ""}`,
          url: `/campo/${id}`,
        });
      }
    } catch (e) {
      console.error("No se pudo mandar el push de nueva asignación:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    orden: ordenActualizada,
    estatus: ordenActualizada.estatus,
    visita_siguiente: visitaSiguiente,
    link_doc: linkDoc,
    link_pdf: linkPdf,
    ...(avisoDoc ? { aviso: avisoDoc } : {}),
  });
}
