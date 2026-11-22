import { linkAccion, paginaAviso } from "@/lib/link-actions";
import { cambiarReservaCliente } from "@/lib/cambio-reserva";

const link = linkAccion({
  purpose: "cancelar-reserva",
  titulo: "¿Cancelar tu cita?",
  boton: "Sí, cancelar mi cita",
  color: "#dc2626",
  exito: "booking-cancelled",
  // HU-22: solo una reserva que aún no se atiende y dentro del plazo de la barbería; avisa por correo
  ejecutar: async (supabase, idReserva) => {
    const result = await cambiarReservaCliente(supabase, idReserva);
    return result.success ? null : paginaAviso("No se pudo cancelar la cita", result.error);
  },
});

export const GET = link.GET;
export const POST = link.POST;
