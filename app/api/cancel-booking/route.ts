import { linkAccion } from "@/lib/link-actions";
import { cambiarReservaCliente } from "@/lib/cambio-reserva";

const link = linkAccion({
  purpose: "cancelar-reserva",
  accion: "cancelar",
  // HU-22: solo una reserva que aún no se atiende y dentro del plazo de la barbería; avisa por correo
  ejecutar: async (supabase, idReserva) => (await cambiarReservaCliente(supabase, idReserva)).success,
});

export const GET = link.GET;
export const POST = link.POST;
