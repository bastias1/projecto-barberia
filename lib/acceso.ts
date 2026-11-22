import type { SupabaseClient } from "@supabase/supabase-js";
import { one, safeNext } from "./utils";

/** Barbería activa donde el usuario tiene una membresía activa. */
export interface Membresia {
  slug: string;
  nombre: string;
  rol: "admin" | "profesional" | "cliente";
}

export interface Acceso {
  /** usuario.rol = 'superadmin' (administrador de la plataforma). */
  esSuperadmin: boolean;
  membresias: Membresia[];
  /** A dónde llevar al usuario tras iniciar sesión (ver `elegirDestino`). */
  destino: string;
}

/**
 * Quién es el usuario y a dónde va: una sola consulta, y `destino` decidido aquí.
 * Sirve con el cliente del navegador y con el del servidor. Si la consulta falla, se
 * registra el error y se cae al caso "sin membresías": el login nunca se rompe.
 * `ctx.next` es la ruta pedida (?next=): se acepta solo si es interna.
 */
export async function resolverAcceso(
  supabase: SupabaseClient,
  userId: string,
  ctx: { barberia?: string | null; next?: string | null } = {},
): Promise<Acceso> {
  const { data, error } = await supabase
    .from("usuario")
    .select("rol, usuario_barberia(rol, activo, barberia:barberia!usuario_barberia_id_barberia_fkey(slug, nombre, activa))")
    .eq("id_usuario", userId)
    .maybeSingle();
  if (error) console.error("[acceso] no se pudo resolver el acceso:", error);

  const esSuperadmin = data?.rol === "superadmin";
  const membresias = ((data?.usuario_barberia ?? []) as { rol: Membresia["rol"]; activo: boolean; barberia: unknown }[]).flatMap((m) => {
    const b = one<{ slug: string; nombre: string; activa: boolean }>(m.barberia);
    return m.activo && b?.activa ? [{ slug: b.slug, nombre: b.nombre, rol: m.rol }] : [];
  });
  return { esSuperadmin, membresias, destino: elegirDestino(membresias, esSuperadmin, ctx.barberia, safeNext(ctx.next)) };
}

/**
 * 1. A `next` si viene: es la página que pidió (checkout, tienda, un dashboard…).
 * 2. Con barbería de origen: a su dashboard si trabaja ahí; si no, a su página
 *    (nunca al dashboard de otra barbería).
 * 3. Sin contexto: el administrador de plataforma a /admin; quien trabaja en una
 *    sola barbería, a su dashboard; el resto a su cuenta (ahí elige barbería).
 */
function elegirDestino(membresias: Membresia[], esSuperadmin: boolean, slug?: string | null, next?: string | null): string {
  if (next) return next;

  const trabajo = membresias.filter((m) => m.rol === "admin" || m.rol === "profesional");
  if (slug) return trabajo.some((m) => m.slug === slug) ? `/${slug}/dashboard` : `/${slug}`;
  if (esSuperadmin) return "/admin";
  return trabajo.length === 1 ? `/${trabajo[0].slug}/dashboard` : "/cuenta";
}
