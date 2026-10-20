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

export interface Membresia {
  slug: string;
  nombre: string;
  rol: "admin" | "profesional" | "cliente";
}

/** Barberías activas donde el usuario tiene una membresía activa. */
export async function getMembresias(supabase: SupabaseClient, userId: string): Promise<Membresia[]> {
  const { data } = await supabase
    .from("usuario_barberia")
    .select("rol, barberia:barberia!usuario_barberia_id_barberia_fkey (slug, nombre, activa)")
    .eq("id_usuario", userId)
    .eq("activo", true);

  return (data ?? []).flatMap((m) => {
    const b = (Array.isArray(m.barberia) ? m.barberia[0] : m.barberia) as { slug: string; nombre: string; activa: boolean } | null;
    return b?.activa ? [{ slug: b.slug, nombre: b.nombre, rol: m.rol as Membresia["rol"] }] : [];
  });
}

/**
 * A dónde llevar a un usuario tras iniciar sesión. Si viene desde una
 * barbería, a su dashboard (personal) o a su página (cliente); si no, a la
 * primera barbería donde trabaja, o a su cuenta (invitaciones y barberías).
 */
export function destinoTrasLogin(membresias: Membresia[], slug?: string | null): string {
  const staff = (m: Membresia) => m.rol === "admin" || m.rol === "profesional";

  if (slug) {
    const enEsta = membresias.find((m) => m.slug === slug);
    return enEsta && staff(enEsta) ? `/${slug}/dashboard` : `/${slug}`;
  }

  const trabajo = membresias.find(staff);
  if (trabajo) return `/${trabajo.slug}/dashboard`;
  return "/cuenta";
}
