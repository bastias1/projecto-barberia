import { linkAccion } from "@/lib/link-actions";

const link = linkAccion({
  purpose: "confirmar-reserva",
  accion: "confirmar",
  ejecutar: async (supabase, idReserva) => {
    // Solo se confirma una reserva que sigue pendiente
    const { error } = await supabase.from("reserva").update({ estado: "confirmada" }).eq("id_reserva", idReserva).eq("estado", "pendiente");
    if (error) console.error("Error confirming booking:", error);
    return !error;
  },
});

export const GET = link.GET;
export const POST = link.POST;
