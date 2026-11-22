import { NextResponse } from "next/server";
import { linkAccion } from "@/lib/link-actions";

const link = linkAccion({
  purpose: "confirmar-reserva",
  titulo: "¿Confirmas tu cita?",
  boton: "Sí, confirmar mi cita",
  color: "#16a34a",
  exito: "booking-confirmed",
  ejecutar: async (supabase, idReserva, request) => {
    // Solo se confirma una reserva que sigue pendiente
    const { error } = await supabase.from("reserva").update({ estado: "confirmada" }).eq("id_reserva", idReserva).eq("estado", "pendiente");
    if (!error) return null;
    console.error("Error confirming booking:", error);
    return NextResponse.redirect(new URL("/error?message=Could+not+confirm+booking", request.url), 303);
  },
});

export const GET = link.GET;
export const POST = link.POST;
