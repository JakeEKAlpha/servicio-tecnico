/**
 * Configuración de los recursos que el Panel de Gerencia puede administrar.
 * Se usa tanto en el API (whitelist de tabla/columnas) como en la UI
 * (cómo dibujar cada campo). No importa nada del servidor: es seguro en
 * componentes de cliente.
 */

export type TipoCampo = "text" | "num" | "bool" | "area" | "select" | "fecha";

export type Campo = {
  k: string;
  label: string;
  tipo: TipoCampo;
  /** para tipo "select": clave de la lista de opciones que pasa la página */
  opciones?: string;
  requerido?: boolean;
  ayuda?: string;
  /** false = se edita en el panel pero no ocupa columna en la tabla (default true). */
  enTabla?: boolean;
};

export type RecursoConfig = {
  tabla: string;
  titulo: string;
  /** columna para ordenar el listado */
  orden: string;
  /** columnas que el API acepta escribir */
  columnas: string[];
  /** campos visibles/editables en la tabla */
  campos: Campo[];
  /** si true, no se puede crear ni borrar desde la UI (solo editar) */
  soloEditar?: boolean;
};

export const RECURSOS: Record<string, RecursoConfig> = {
  ingenieros: {
    tabla: "ingenieros",
    titulo: "Ingenieros",
    orden: "nombre",
    columnas: [
      "nombre",
      "zona_id",
      "sucursal_id",
      "correo",
      "telefono",
      "empresa_id",
      "nombre_corto",
      "viaje_min",
      "activo",
    ],
    campos: [
      { k: "nombre", label: "Nombre", tipo: "text", requerido: true },
      {
        k: "zona_id",
        label: "Zona",
        tipo: "select",
        opciones: "zonas",
        enTabla: false,
      },
      {
        k: "sucursal_id",
        label: "Sucursal",
        tipo: "select",
        opciones: "sucursales_id",
      },
      { k: "correo", label: "Correo", tipo: "text" },
      { k: "telefono", label: "Teléfono", tipo: "text" },
      {
        k: "empresa_id",
        label: "Empresa",
        tipo: "select",
        opciones: "empresas_id",
      },
      {
        k: "nombre_corto",
        label: "Nombre corto",
        tipo: "text",
        ayuda: "El de su carpeta de Drive, si existe.",
      },
      { k: "viaje_min", label: "Viaje (min)", tipo: "num" },
      { k: "activo", label: "Activo", tipo: "bool" },
    ],
  },

  sucursales: {
    tabla: "sucursales",
    titulo: "Sucursales",
    orden: "nombre",
    columnas: ["nombre", "ciudad", "estado", "empresa_id", "zona_id", "lat", "lng", "activa"],
    campos: [
      { k: "nombre", label: "Nombre", tipo: "text", requerido: true },
      { k: "ciudad", label: "Ciudad", tipo: "text" },
      { k: "estado", label: "Estado", tipo: "text" },
      { k: "empresa_id", label: "Empresa", tipo: "select", opciones: "empresas_id" },
      { k: "zona_id", label: "Zona", tipo: "select", opciones: "zonas" },
      { k: "lat", label: "Lat", tipo: "num" },
      { k: "lng", label: "Lng", tipo: "num" },
      { k: "activa", label: "Activa", tipo: "bool" },
    ],
  },

  gestores: {
    tabla: "gestores_cuenta",
    titulo: "Gestores de cuenta Lexmark",
    orden: "nombre",
    columnas: ["nombre", "correo", "telefono", "empresa", "marca_id", "rol_contacto", "notas", "activo"],
    campos: [
      { k: "nombre", label: "Nombre", tipo: "text", requerido: true },
      { k: "correo", label: "Correo", tipo: "text" },
      { k: "telefono", label: "Teléfono", tipo: "text" },
      { k: "empresa", label: "Empresa", tipo: "text" },
      { k: "marca_id", label: "Marca", tipo: "select", opciones: "marcas" },
      {
        k: "rol_contacto",
        label: "Puesto",
        tipo: "text",
        ayuda: "gestor de cuenta, logística, etc.",
      },
      { k: "notas", label: "Notas", tipo: "area" },
      { k: "activo", label: "Activo", tipo: "bool" },
    ],
  },

  cuentas: {
    tabla: "clientes",
    titulo: "Clientes / cuentas",
    orden: "nombre",
    columnas: [
      "nombre",
      "tipo",
      "gestor_id",
      "indicaciones",
      "indicaciones_coordinador",
      "indicaciones_ingeniero",
      "contacto_nombre",
      "contacto_correo",
      "contacto_telefono",
      "activo",
    ],
    campos: [
      { k: "nombre", label: "Nombre", tipo: "text", requerido: true },
      { k: "tipo", label: "Tipo", tipo: "text", ayuda: "cuenta, cliente…" },
      {
        k: "gestor_id",
        label: "Gestor de cuenta",
        tipo: "select",
        opciones: "gestores",
        ayuda: "Quién administra esta cuenta desde Lexmark.",
      },
      {
        k: "indicaciones",
        label: "Indicaciones (texto libre — legado)",
        tipo: "area",
        ayuda: "Se está dividiendo cuenta por cuenta en los dos campos de abajo. No editar aquí para cuentas ya divididas.",
        enTabla: false,
      },
      {
        k: "indicaciones_coordinador",
        label: "Para Coordinador",
        tipo: "area",
        ayuda: "Lo que se resuelve antes de la visita: avisos, correos de acceso, anticipación, documentos a enviar.",
      },
      {
        k: "indicaciones_ingeniero",
        label: "Para Ingeniero",
        tipo: "area",
        ayuda: "Lo que el ingeniero hace/lleva en sitio: EPP, identificación, credencial, cursos previos.",
      },
      { k: "contacto_nombre", label: "Contacto", tipo: "text" },
      { k: "contacto_correo", label: "Correo contacto", tipo: "text" },
      { k: "contacto_telefono", label: "Tel. contacto", tipo: "text" },
      { k: "activo", label: "Activo", tipo: "bool" },
    ],
  },

  equipos: {
    tabla: "equipos",
    titulo: "Equipos",
    orden: "modelo",
    columnas: ["cliente_id", "marca_id", "modelo", "serie", "notas", "activo"],
    campos: [
      {
        k: "cliente_id",
        label: "Cliente",
        tipo: "select",
        opciones: "cuentas_id",
        ayuda: "Opcional: a quién pertenece el equipo.",
      },
      { k: "marca_id", label: "Marca", tipo: "select", opciones: "marcas", requerido: true },
      { k: "modelo", label: "Modelo", tipo: "text", requerido: true },
      { k: "serie", label: "Número de serie", tipo: "text" },
      { k: "notas", label: "Notas", tipo: "area" },
      { k: "activo", label: "Activo", tipo: "bool" },
    ],
  },

  contratos: {
    tabla: "contratos",
    titulo: "Contratos (garantía / póliza / renta / TyM)",
    orden: "cliente_id",
    columnas: [
      "cliente_id",
      "equipo_id",
      "marca_id",
      "tipo_contrato",
      "subtipo_tym",
      "solicitado_por_gestor_id",
      "fecha_inicio",
      "fecha_fin",
      "visitas_incluidas",
      "notas",
      "activo",
    ],
    campos: [
      { k: "cliente_id", label: "Cliente", tipo: "select", opciones: "cuentas_id", requerido: true },
      {
        k: "equipo_id",
        label: "Equipo",
        tipo: "select",
        opciones: "equipos_id",
        ayuda: "Vacío = cubre todos los equipos del cliente.",
      },
      { k: "marca_id", label: "Marca", tipo: "select", opciones: "marcas", requerido: true },
      {
        k: "tipo_contrato",
        label: "Tipo",
        tipo: "select",
        opciones: "tipos_contrato",
        requerido: true,
      },
      {
        k: "subtipo_tym",
        label: "Subtipo TyM",
        tipo: "select",
        opciones: "subtipos_tym",
        ayuda: "Solo si Tipo = TyM: mano de obra, inspección o instalación.",
      },
      {
        k: "solicitado_por_gestor_id",
        label: "Solicitado por (ejecutivo)",
        tipo: "select",
        opciones: "gestores",
        ayuda: "Solo si lo pidió un ejecutivo (instalación / garantía de consumible), no el cliente.",
      },
      { k: "fecha_inicio", label: "Inicio", tipo: "fecha", requerido: true },
      {
        k: "fecha_fin",
        label: "Fin",
        tipo: "fecha",
        ayuda:
          "En garantía/póliza/renta: mientras esté vacío NO cuenta como vigente (dato sin validar). Ponla al validarlo con el vencimiento real.",
      },
      {
        k: "visitas_incluidas",
        label: "Visitas incluidas",
        tipo: "num",
        ayuda: "Vacío = ilimitadas.",
      },
      { k: "notas", label: "Notas", tipo: "area" },
      { k: "activo", label: "Activo", tipo: "bool" },
    ],
  },

  contactos: {
    tabla: "contactos_cuenta",
    titulo: "Directorio de cuentas",
    orden: "cuenta_id",
    columnas: ["cuenta_id", "nombre", "rol_contacto", "correo", "telefono", "notas", "activo"],
    campos: [
      {
        k: "cuenta_id",
        label: "Cuenta Lexmark",
        tipo: "select",
        opciones: "cuentas_id",
        requerido: true,
      },
      { k: "nombre", label: "Nombre", tipo: "text" },
      {
        k: "rol_contacto",
        label: "Tipo",
        tipo: "select",
        opciones: "roles_contacto",
        ayuda: "mesa = mesa de servicio / help desk",
      },
      { k: "correo", label: "Correo", tipo: "text" },
      { k: "telefono", label: "Teléfono", tipo: "text" },
      { k: "notas", label: "Notas", tipo: "text" },
      { k: "activo", label: "Activo", tipo: "bool" },
    ],
  },

  zonas: {
    tabla: "zonas",
    titulo: "Zonas",
    orden: "nombre",
    columnas: ["nombre", "coordinador_nombre", "drive_folder_id", "empresa_id"],
    soloEditar: true,
    campos: [
      { k: "nombre", label: "Nombre", tipo: "text", requerido: true },
      { k: "coordinador_nombre", label: "Coordinador", tipo: "text" },
      { k: "drive_folder_id", label: "Carpeta Drive (ID)", tipo: "text" },
      {
        k: "empresa_id",
        label: "Empresa",
        tipo: "select",
        opciones: "empresas_id",
        ayuda: "El nombre de la zona sigue diciendo la empresa (ej. \"Alpha Digital Zona 1\") — esto es solo la referencia formal.",
      },
    ],
  },

  marcas: {
    tabla: "marcas",
    titulo: "Marcas",
    orden: "nombre",
    columnas: ["nombre", "es_partner"],
    campos: [
      { k: "nombre", label: "Nombre", tipo: "text", requerido: true },
      {
        k: "es_partner",
        label: "Somos partner oficial",
        tipo: "bool",
        ayuda: "Marca el fabricante real del equipo (Lexmark, Xerox, HP...). Actívalo solo si Alpha Digital es partner oficial de esa marca — hoy: Lexmark y Xerox. \"Propio\" nunca es partner, representa servicios directos sin importar la marca del equipo.",
      },
    ],
  },

  coordinadores: {
    tabla: "perfiles",
    titulo: "Usuarios (quién asigna)",
    orden: "nombre",
    columnas: ["nombre", "rol", "zona_id", "ingeniero_id"],
    soloEditar: true,
    campos: [
      { k: "nombre", label: "Nombre", tipo: "text", requerido: true },
      {
        k: "rol",
        label: "Rol",
        tipo: "select",
        opciones: "roles",
      },
      { k: "zona_id", label: "Zona", tipo: "select", opciones: "zonas" },
      {
        k: "ingeniero_id",
        label: "Ficha de ingeniero",
        tipo: "select",
        opciones: "ingenieros_id",
        ayuda: "Solo para rol 'ingeniero': enlaza el usuario con su ficha del catálogo (la que reciben las órdenes).",
      },
    ],
  },

  encargados: {
    tabla: "encargados_almacen",
    titulo: "Encargados de almacén",
    orden: "sucursal_id",
    columnas: ["perfil_id", "sucursal_id"],
    campos: [
      {
        k: "perfil_id",
        label: "Persona",
        tipo: "select",
        opciones: "perfiles",
        requerido: true,
        ayuda: "Debe tener un usuario (perfil) creado, idealmente con rol 'almacen'.",
      },
      {
        k: "sucursal_id",
        label: "Sucursal",
        tipo: "select",
        opciones: "sucursales_id",
        requerido: true,
      },
    ],
  },
};

/**
 * Agrupa los recursos para el riel de Gerencia (wireframe 11p: "riel de
 * recursos agrupado — personas / lugares / clientes").
 */
export const GRUPOS_RECURSOS: { titulo: string; recursos: string[] }[] = [
  { titulo: "Personas", recursos: ["ingenieros", "coordinadores", "encargados"] },
  { titulo: "Lugares", recursos: ["sucursales", "zonas"] },
  {
    titulo: "Clientes",
    recursos: ["gestores", "cuentas", "contactos", "equipos", "contratos"],
  },
  { titulo: "Catálogo", recursos: ["marcas"] },
];

export const ROLES_PERFIL = [
  "coordinador",
  "ingeniero",
  "almacen",
  "gerencia",
  "admin",
] as const;

/** Valores de `contratos.tipo_contrato` (texto + CHECK, no enum). */
export const TIPOS_CONTRATO: { value: string; label: string }[] = [
  { value: "garantia", label: "Garantía" },
  { value: "poliza", label: "Póliza" },
  { value: "renta", label: "Renta" },
  { value: "tym", label: "TyM" },
  { value: "instalacion", label: "Instalación (ejecutivo)" },
  { value: "garantia_consumible", label: "Garantía de consumible (ejecutivo)" },
];

/** Subtipos de un contrato TyM (`contratos.subtipo_tym`). */
export const SUBTIPOS_TYM: { value: string; label: string }[] = [
  { value: "mo", label: "Mantenimiento correctivo / MO" },
  { value: "ip", label: "Inspección (IP)" },
  { value: "instalacion", label: "Instalación" },
];
