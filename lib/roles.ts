import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rol efectivo de un usuario en una barbería:
 * - usuario.rol = 'superadmin' es global
 * - usuario_barberia.rol ('admin' | 'profesional' | 'cliente') es por barbería
 */
export type RolApp = "superadmin" | "admin" | "profesional" | "cliente";

export async function getRolApp(supabase: SupabaseClient, userId: string, idBarberia: string): Promise<RolApp> {
  const [{ data: usuario }, { data: membresia }] = await Promise.all([
    supabase.from("usuario").select("rol").eq("id_usuario", userId).maybeSingle(),
    supabase
      .from("usuario_barberia")
      .select("rol")
      .eq("id_usuario", userId)
      .eq("id_barberia", idBarberia)
      .eq("activo", true)
      .maybeSingle(),
  ]);

  if (usuario?.rol === "superadmin") return "superadmin";
  if (membresia?.rol === "admin" || membresia?.rol === "profesional") return membresia.rol;
  return "cliente";
}

export function isStaffRol(rol: RolApp | null | undefined): boolean {
  return rol === "superadmin" || rol === "admin" || rol === "profesional";
}

export function isAdminRol(rol: RolApp | null | undefined): boolean {
  return rol === "superadmin" || rol === "admin";
}

export const ROL_LABEL: Record<RolApp, string> = {
  superadmin: "Superadmin",
  admin: "Administrador",
  profesional: "Barbero",
  cliente: "Cliente",
};
