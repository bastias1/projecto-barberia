'use server'

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getStaffContext } from "@/lib/staff-context";
import { crearReserva, type CrearReservaInput, type CrearReservaResult } from "@/app/[slug]/agendar/actions";

export interface CrearCitaManualInput extends CrearReservaInput {
  confirmar: boolean; // el barbero ya habló con el cliente
}

/**
 * Cita registrada por el personal (reserva por teléfono o cliente sin hora).
 * Usa el mismo camino que la reserva pública (RPC reservar_como_invitado,
 * clientes bloqueados, correo de confirmación) y opcionalmente la confirma.
 */
export async function crearCitaManual(input: CrearCitaManualInput): Promise<CrearReservaResult> {
  const ctx = await getStaffContext(input.slug);
  if (!ctx?.isStaff) {
    return { success: false, error: "No tienes permiso para agendar en esta barbería" };
  }
  // Un barbero agenda en su propia agenda; el administrador, en cualquiera
  if (input.barberoId !== ctx.userId && !ctx.isAdmin) {
    return { success: false, error: "Solo puedes agendar citas en tu propia agenda" };
  }

  const { confirmar, ...reserva } = input;
  const result = await crearReserva(reserva);
  if (!result.success) {
    return result.error === "CLIENT_BLOCKED"
      ? { success: false, error: "Este cliente está bloqueado en la barbería" }
      : result;
  }

  if (confirmar) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("reserva")
      .update({ estado: "confirmada" })
      .eq("id_reserva", result.idReserva)
      .eq("estado", "pendiente");
    if (error) console.error("Error confirming manual booking:", error);
  }

  revalidatePath("/[slug]/dashboard", "layout");
  return result;
}
