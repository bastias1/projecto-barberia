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

/** ¿El usuario es administrador de la plataforma (usuario.rol = 'superadmin')? */
export async function esSuperadmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("usuario").select("rol").eq("id_usuario", userId).maybeSingle();
  return data?.rol === "superadmin";
}

/**
 * A dónde llevar a un usuario tras iniciar sesión.
 * 1. A `next` si viene: es la página que pidió (checkout, tienda, un dashboard…).
 * 2. Con barbería de origen: a su dashboard si trabaja ahí; si no, a su página
 *    (nunca al dashboard de otra barbería).
 * 3. Sin contexto: el administrador de plataforma a /admin; quien trabaja en una
 *    sola barbería, a su dashboard; el resto a su cuenta (ahí elige barbería).
 */
export function destinoTrasLogin(membresias: Membresia[], slug?: string | null, next?: string | null, superadmin = false): string {
  if (next) return next;

  const trabajo = membresias.filter((m) => m.rol === "admin" || m.rol === "profesional");
  if (slug) return trabajo.some((m) => m.slug === slug) ? `/${slug}/dashboard` : `/${slug}`;
  if (superadmin) return "/admin";
  return trabajo.length === 1 ? `/${trabajo[0].slug}/dashboard` : "/cuenta";
}
