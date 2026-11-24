import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TZ, formatPlazo } from "./barberia";
import { fromZoned } from "./datetime";
import { notificarCambioReserva } from "./notifications";

import type { ResultadoAccion } from "./utils";

export interface NuevaHora {
  fecha: string; // YYYY-MM-DD local de la sucursal
  hora: string;  // HH:mm
  idSucursal: number;
}

/**
 * HU-22: el cliente cancela (sin `nueva`) o reprograma su reserva. Las reglas (dueño,
 * estado, plazo de la barbería, horario libre) están en la RPC cambiar_reserva_cliente.
 * `supabase` es el cliente con la sesión del dueño, o el de service role cuando ya se
 * verificó el link firmado del correo. Solo servidor.
 */
export async function cambiarReservaCliente(supabase: SupabaseClient, idReserva: number, nueva?: NuevaHora): Promise<ResultadoAccion> {
  let inicio: string | null = null;
  if (nueva) {
    const { data: sucursal } = await supabase.from("sucursal").select("zona_horaria").eq("id_sucursal", nueva.idSucursal).maybeSingle();
    inicio = fromZoned(nueva.fecha, nueva.hora, sucursal?.zona_horaria || DEFAULT_TZ).toISOString();
  }

  const { error } = await supabase.rpc("cambiar_reserva_cliente", {
    p_reserva: idReserva,
    p_nuevo_inicio: inicio,
    p_sucursal: nueva?.idSucursal ?? null,
  });

  if (error) {
    if (error.message.includes("FUERA_DE_PLAZO")) {
      const { data: reserva } = await supabase.from("reserva").select("id_barberia").eq("id_reserva", idReserva).maybeSingle();
      const { data: barberia } = await supabase.from("barberia").select("plazo_cancelacion_min").eq("id_barberia", reserva?.id_barberia ?? "").maybeSingle();
      const plazo = barberia ? ` Se aceptan cambios hasta ${formatPlazo(barberia.plazo_cancelacion_min)} antes de la cita.` : "";
      return { success: false, error: `Ya no es posible ${nueva ? "cambiar la hora" : "cancelar"} esta cita.${plazo}` };
    }
    if (error.code === "23P01") return { success: false, error: "Ese horario acaba de ser reservado. Elige otro." };
    if (error.code === "42501") return { success: false, error: "No encontramos esta reserva." };
    if (error.code === "23514") return { success: false, error: error.message }; // validaciones de los triggers
    console.error("Error changing booking:", error);
    return { success: false, error: "No se pudo modificar la reserva" };
  }

  await notificarCambioReserva(idReserva, nueva ? "reprogramada" : "cancelada").catch((e) => console.error("Error en aviso de cambio de reserva:", e));
  return { success: true };
}
