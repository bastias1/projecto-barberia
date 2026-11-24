import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rol efectivo de un usuario en una barbería: usuario_barberia.rol ('admin' | 'profesional' | 'cliente').
 * `usuario.rol = 'superadmin'` NO da acceso al dashboard de ninguna barbería (privacidad de sus clientes):
 * administra la plataforma desde /admin y, aquí, cuenta como cliente salvo que sea miembro.
 */
export type RolApp = "admin" | "profesional" | "cliente";

export async function getRolApp(supabase: SupabaseClient, userId: string, idBarberia: string): Promise<RolApp> {
  const { data: membresia } = await supabase
    .from("usuario_barberia")
    .select("rol")
    .eq("id_usuario", userId)
    .eq("id_barberia", idBarberia)
    .eq("activo", true)
    .maybeSingle();

  return membresia?.rol === "admin" || membresia?.rol === "profesional" ? membresia.rol : "cliente";
}

export function isStaffRol(rol: RolApp | null | undefined): boolean {
  return rol === "admin" || rol === "profesional";
}

/** Atiende clientes (tiene agenda): un barbero siempre; un admin solo si lo activa. */
export function tieneAgenda(rol: RolApp, atiende?: boolean): boolean {
  return rol === "profesional" || (rol === "admin" && !!atiende);
}

export function isAdminRol(rol: RolApp | null | undefined): boolean {
  return rol === "admin";
}

export const ROL_LABEL: Record<RolApp, string> = {
  admin: "Administrador",
  profesional: "Barbero",
  cliente: "Cliente",
};
