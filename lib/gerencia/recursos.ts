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
      "sucursal",
      "correo",
      "telefono",
      "empresa",
      "nombre_corto",
      "viaje_min",
      "activo",
    ],
    campos: [
      { k: "nombre", label: "Nombre", tipo: "text", requerido: true },
      { k: "zona_id", label: "Zona", tipo: "select", opciones: "zonas" },
      { k: "sucursal", label: "Sucursal", tipo: "select", opciones: "sucursales" },
      { k: "correo", label: "Correo", tipo: "text" },
      { k: "telefono", label: "Teléfono", tipo: "text" },
      { k: "empresa", label: "Empresa", tipo: "text" },
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
    columnas: ["nombre", "ciudad", "estado", "empresa", "zona_id", "lat", "lng", "activa"],
    campos: [
      { k: "nombre", label: "Nombre", tipo: "text", requerido: true },
      { k: "ciudad", label: "Ciudad", tipo: "text" },
      { k: "estado", label: "Estado", tipo: "text" },
      { k: "empresa", label: "Empresa", tipo: "text", ayuda: "alpha o baja" },
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
        label: "Indicaciones de la cuenta",
        tipo: "area",
        ayuda: "Cómo se atiende esta cuenta: reglas, contactos, formatos…",
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
    titulo: "Contratos (garantía / póliza / TyM)",
    orden: "cliente_id",
    columnas: [
      "cliente_id",
      "equipo_id",
      "marca_id",
      "tipo_contrato",
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
      { k: "fecha_inicio", label: "Inicio", tipo: "fecha", requerido: true },
      { k: "fecha_fin", label: "Fin", tipo: "fecha", ayuda: "Vacío = indefinido." },
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
    titulo: "Mesas de servicio y contactos por cuenta",
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
    columnas: ["nombre", "coordinador_nombre", "drive_folder_id"],
    soloEditar: true,
    campos: [
      { k: "nombre", label: "Nombre", tipo: "text", requerido: true },
      { k: "coordinador_nombre", label: "Coordinador", tipo: "text" },
      { k: "drive_folder_id", label: "Carpeta Drive (ID)", tipo: "text" },
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
];

export const ROLES_PERFIL = [
  "coordinador",
  "ingeniero",
  "almacen",
  "gerencia",
  "admin",
] as const;

/** Los 3 valores de `contratos.tipo_contrato` (texto + CHECK, no enum). */
export const TIPOS_CONTRATO: { value: string; label: string }[] = [
  { value: "garantia", label: "Garantía" },
  { value: "poliza", label: "Póliza" },
  { value: "tym", label: "TyM" },
];
