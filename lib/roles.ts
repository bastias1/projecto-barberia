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

// Rutas a las que el personal sí debe llegar aunque tenga dashboard
const RUTAS_DE_TRABAJO = [/^\/invitacion\//, /^\/registro/, /^\/cuenta/, /\/dashboard(\/|$|\?)/];

/**
 * A dónde llevar a un usuario tras iniciar sesión.
 * - Personal (admin o barbero): a su dashboard (el de la barbería de origen si
 *   trabaja ahí), salvo que `next` sea una ruta de trabajo (invitación,
 *   registro de barbería, su cuenta o un dashboard).
 * - Cliente o sin barbería: a `next`, o a la barbería de origen, o a su cuenta
 *   (invitaciones, barberías y crear la suya).
 * - Administrador de plataforma sin barbería de origen: al panel /admin.
 */
export function destinoTrasLogin(membresias: Membresia[], slug?: string | null, next?: string | null, superadmin = false): string {
  const staff = (m: Membresia) => m.rol === "admin" || m.rol === "profesional";
  const trabajo = membresias.filter(staff);

  if (superadmin && !slug && !(next && RUTAS_DE_TRABAJO.some((r) => r.test(next)))) {
    return next?.startsWith("/admin") ? next : "/admin";
  }

  if (trabajo.length > 0) {
    if (next && RUTAS_DE_TRABAJO.some((r) => r.test(next))) return next;
    const enEsta = slug ? trabajo.find((m) => m.slug === slug) : undefined;
    return `/${(enEsta ?? trabajo[0]).slug}/dashboard`;
  }

  if (next) return next;
  return slug ? `/${slug}` : "/cuenta";
}
