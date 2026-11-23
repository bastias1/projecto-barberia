"use server"

import { createClient } from "@/utils/supabase/server";
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
