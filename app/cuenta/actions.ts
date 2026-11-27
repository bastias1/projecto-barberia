"use server"

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { eliminarBarberiaDe } from "@/lib/eliminar-barberia";
import type { ResultadoAccion } from "@/lib/utils";
import { notificarInvitacionAceptada, notificarSeguridad } from "@/lib/notifications";

/** Llamado tras cambiar la contraseña o pedir otro correo desde el navegador: el aviso va al correo actual de la sesión. */
export async function avisarCambioSeguridad(cambio: "clave" | "correo", nuevoCorreo?: string): Promise<void> {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (user?.email) await notificarSeguridad(user.email, cambio, nuevoCorreo);
}

/** Llamado tras aceptar una invitación (RPC desde el navegador): avisa al administrador que la envió. */
export async function avisarInvitacionAceptada(token: string): Promise<void> {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (user?.email) await notificarInvitacionAceptada(token, user.email);
}

/** El propietario elimina su barbería (borrado lógico). Service role recién después de saber quién es. */
export async function eliminarBarberia(idBarberia: string, confirmacion: string): Promise<ResultadoAccion> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Inicia sesión de nuevo" }

  // RLS: el propietario la ve aunque esté suspendida
  const { data: barberia } = await supabase.from("barberia").select("nombre").eq("id_barberia", idBarberia).eq("id_propietario", user.id).maybeSingle()
  if (!barberia) return { success: false, error: "Solo el propietario puede eliminar la barbería" }
  if (confirmacion.trim() !== barberia.nombre.trim()) return { success: false, error: "El nombre no coincide" }

  const result = await eliminarBarberiaDe(createServiceRoleClient(), { idBarberia, idUsuario: user.id })
  if (result.success) revalidatePath("/cuenta")
  return result
}
