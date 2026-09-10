/** Roles que ven y editan todas las zonas. */
export const ROLES_VEN_TODO = ["gerencia", "admin"] as const;

export function esRolQueVeTodo(rol: string | null | undefined): boolean {
  return (ROLES_VEN_TODO as readonly string[]).includes(String(rol ?? ""));
}

/**
 * Etiqueta legible de cada rol. El VALOR del enum en la BD es un identificador
 * estable (coordinador, gerencia, …); lo que se muestra al usuario vive aquí.
 */
export const ETIQUETA_ROL: Record<string, string> = {
  coordinador: "Coordinador",
  ingeniero: "Ingeniero",
  gerencia: "Gerente",
  admin: "Administrador",
  almacen: "Encargado de almacén",
};

export function etiquetaRol(rol: string | null | undefined): string {
  const k = String(rol ?? "");
  return ETIQUETA_ROL[k] ?? k;
}
