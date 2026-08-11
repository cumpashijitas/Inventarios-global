/**
 * Definición central de roles y permisos del sistema.
 *
 * Los códigos de rol deben coincidir exactamente con los valores
 * almacenados en roles_empresa.codigo en la base de datos.
 */

export const ROL = {
  ADMIN:                 "admin",
  VENDEDOR:              "vendedor",
  ENCARGADO_INVENTARIO:  "encargado_inventario",
  CAJERO:                "cajero",
} as const;

export type Rol = (typeof ROL)[keyof typeof ROL];

/** Etiqueta legible para mostrar en la UI */
export const ROL_LABEL: Record<string, string> = {
  admin:                "Administrador",
  vendedor:             "Vendedor",
  encargado_inventario: "Enc. Inventario",
  cajero:               "Cajero",
};

/**
 * Mapa de permisos: qué roles pueden acceder a cada sección.
 * Clave = permiso lógico de la app, Valor = roles permitidos.
 *
 * El admin siempre tiene acceso a todo — se revisa primero.
 */
export const PERMISOS: Record<string, Rol[]> = {
  dashboard:           ["admin", "vendedor", "encargado_inventario", "cajero"],
  inventario_ver:      ["admin", "vendedor", "encargado_inventario"],
  inventario_editar:   ["admin", "encargado_inventario"],
  carga_masiva:        ["admin", "encargado_inventario"],
  ventas:              ["admin", "vendedor", "cajero"],
  caja:                ["admin", "cajero"],
  reportes:            ["admin", "vendedor", "encargado_inventario", "cajero"],
  configuracion:       ["admin"],
};

/**
 * Retorna true si ALGUNO de los roles del usuario tiene el permiso indicado
 * (unión de permisos — un usuario puede tener varios roles a la vez, ej.
 * Encargado de Inventario + Vendedor). Lista vacía/null → false.
 */
export function puedeAcceder(roles: string[] | null | undefined, permiso: keyof typeof PERMISOS): boolean {
  if (!roles || roles.length === 0) return false;
  if (roles.includes(ROL.ADMIN)) return true;    // admin pasa siempre
  const permitidos = PERMISOS[permiso] as string[];
  return roles.some((r) => permitidos.includes(r));
}

/** Roles que pueden ver el inventario */
export const ROLES_INVENTARIO = PERMISOS.inventario_ver;
/** Roles que pueden hacer carga masiva */
export const ROLES_CARGA_MASIVA = PERMISOS.carga_masiva;
/** Roles que pueden acceder a ventas */
export const ROLES_VENTAS = PERMISOS.ventas;
/** Roles que pueden acceder a caja */
export const ROLES_CAJA = PERMISOS.caja;
/** Solo admin */
export const ROLES_ADMIN_ONLY: Rol[] = [ROL.ADMIN];
