'use server'

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getStaffContext } from "@/lib/staff-context";
import { notificarInvitacion } from "@/lib/notifications";

// correoEnviado: si falló, el admin puede copiar el link desde Equipo
type Resultado = { success: true; correoEnviado?: boolean } | { success: false; error: string };

const VIGENCIA_MS = 14 * 24 * 60 * 60 * 1000;

async function contextoAdmin(slug: string) {
  const ctx = await getStaffContext(slug);
  return ctx?.isAdmin ? ctx : null;
}

/**
 * Invita a una persona al equipo por correo (tenga o no cuenta). La base
 * valida la suscripción vigente, el límite de barberos y que no sea ya del
 * equipo (trigger a_invitacion_validar).
 */
export async function invitarMiembro(input: { slug: string; correo: string; rol: "profesional" | "admin" }): Promise<Resultado> {
  const ctx = await contextoAdmin(input.slug);
  if (!ctx) return { success: false, error: "Solo un administrador puede invitar" };
  if (!["profesional", "admin"].includes(input.rol)) return { success: false, error: "Rol inválido" };

  const correo = input.correo.trim().toLowerCase();
  if (correo === ctx.email.toLowerCase()) return { success: false, error: "No puedes invitarte a ti mismo" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitacion")
    .insert({ id_barberia: ctx.barberia.id_barberia, correo, rol: input.rol })
    .select("id_invitacion")
    .single();

  if (error || !data) {
    console.error("Error creating invitation:", error);
    if (error?.code === "23505") return { success: false, error: "Ya hay una invitación pendiente para ese correo" };
    if (error?.code === "23514") return { success: false, error: error.message };
    return { success: false, error: "No se pudo crear la invitación" };
  }

  const correoEnviado = await notificarInvitacion(data.id_invitacion);
  revalidatePath("/[slug]/dashboard/usuarios", "page");
  return { success: true, correoEnviado };
}

/** Vuelve a enviar el correo y extiende la vigencia 14 días. */
export async function reenviarInvitacion(input: { slug: string; idInvitacion: number }): Promise<Resultado> {
  const ctx = await contextoAdmin(input.slug);
  if (!ctx) return { success: false, error: "Solo un administrador puede reenviar invitaciones" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitacion")
    .update({ expira_at: new Date(Date.now() + VIGENCIA_MS).toISOString() })
    .eq("id_invitacion", input.idInvitacion)
    .eq("id_barberia", ctx.barberia.id_barberia)
    .eq("estado", "pendiente")
    .select("id_invitacion")
    .maybeSingle();

  if (error || !data) return { success: false, error: "La invitación ya no está pendiente" };

  const correoEnviado = await notificarInvitacion(data.id_invitacion);
  revalidatePath("/[slug]/dashboard/usuarios", "page");
  return { success: true, correoEnviado };
}

export async function cancelarInvitacion(input: { slug: string; idInvitacion: number }): Promise<Resultado> {
  const ctx = await contextoAdmin(input.slug);
  if (!ctx) return { success: false, error: "Solo un administrador puede cancelar invitaciones" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitacion")
    .update({ estado: "cancelada", respondida_at: new Date().toISOString() })
    .eq("id_invitacion", input.idInvitacion)
    .eq("id_barberia", ctx.barberia.id_barberia)
    .eq("estado", "pendiente")
    .select("id_invitacion")
    .maybeSingle();

  if (error || !data) return { success: false, error: "La invitación ya no está pendiente" };

  revalidatePath("/[slug]/dashboard/usuarios", "page");
  return { success: true };
}
