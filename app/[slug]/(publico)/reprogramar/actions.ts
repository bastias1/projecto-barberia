'use server'

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { verifyLink } from "@/lib/signed-links";
import { cambiarReservaCliente, type NuevaHora } from "@/lib/cambio-reserva";
import type { ResultadoAccion } from "@/lib/utils";

/**
 * HU-22: cancelar (sin `nueva`) o reprogramar una reserva propia. Autoriza el link
 * firmado del correo (invitados, sin sesión) o la sesión del dueño de la reserva.
 */
export async function cambiarReserva(input: { id: number; token?: string | null; nueva?: NuevaHora }): Promise<ResultadoAccion> {
  const conLink = verifyLink("cancelar-reserva", input.id, input.token);
  const supabase = conLink ? createServiceRoleClient() : await createClient();
  const result = await cambiarReservaCliente(supabase, input.id, input.nueva);
  if (result.success) revalidatePath("/[slug]/dashboard", "layout");
  return result;
}
