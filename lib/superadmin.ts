import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

/*
 * Panel de la plataforma (/admin): solo cuentas con usuario.rol = 'superadmin'.
 * El superadmin tiene políticas *_superadmin (ALL) en todas las tablas, así
 * que el panel usa su propia sesión (RLS). Solo cambiar usuario.rol /
 * deleted_at y suspender cuentas en Auth necesitan service role.
 */

export interface Superadmin {
  userId: string;
  email: string;
  nombre: string;
}

/** Superadmin con sesión iniciada, o null. Cacheado por request. */
export const getSuperadmin = cache(async (): Promise<Superadmin | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("usuario").select("nombre, rol").eq("id_usuario", user.id).maybeSingle();
  if (data?.rol !== "superadmin") return null;
  return { userId: user.id, email: user.email ?? "", nombre: data.nombre };
});

/** Para páginas de /admin: redirige si no es superadmin. */
export async function requireSuperadmin(): Promise<Superadmin> {
  const admin = await getSuperadmin();
  if (admin) return admin;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/cuenta" : "/login?next=/admin");
}

export type EntidadAuditoria = "barberia" | "plan" | "usuario";

/** Agrega una fila a la bitácora (auditoria_admin). Nunca lanza: la acción ya se aplicó. */
export async function registrarAccion(
  supabase: SupabaseClient,
  admin: Superadmin,
  accion: string,
  entidad: EntidadAuditoria,
  idEntidad: string | number,
  detalle: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from("auditoria_admin").insert({
    id_usuario: admin.userId,
    accion,
    entidad,
    id_entidad: String(idEntidad),
    detalle,
  });
  if (error) console.error(`[auditoria] No se pudo registrar ${accion}:`, error);
}

/** Texto legible de cada acción de la bitácora. */
export const ACCION_LABEL: Record<string, string> = {
  extender_vigencia: "extendió la vigencia",
  cambiar_plan: "cambió el plan",
  activar_cortesia: "activó como cortesía",
  eliminar_suscripcion: "eliminó la suscripción",
  suspender_barberia: "suspendió la barbería",
  reactivar_barberia: "reactivó la barbería",
  editar_plan: "editó el plan",
  crear_plan: "creó el plan",
  archivar_plan: "archivó el plan",
  reactivar_plan: "reactivó el plan",
  eliminar_plan: "eliminó el plan",
  dar_superadmin: "dio rol de administrador de plataforma a",
  quitar_superadmin: "quitó el rol de administrador de plataforma a",
  suspender_usuario: "suspendió la cuenta de",
  reactivar_usuario: "reactivó la cuenta de",
  eliminar_datos: "eliminó los datos personales de",
};
