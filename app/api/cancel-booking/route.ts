import { NextResponse } from "next/server";
import { paginaAviso, paginaConfirmarAccion, verifyLink } from "@/lib/signed-links";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { getBarberiaById } from "@/lib/barberia";
import { cambiarReservaCliente } from "@/lib/cambio-reserva";

// El link firmado autoriza la acción: quien lo abre no tiene sesión
function idVerificado(request: Request): string | null {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  return id && verifyLink("cancelar-reserva", id, searchParams.get("token")) ? id : null;
}

const linkInvalido = (request: Request) => NextResponse.redirect(new URL('/error?message=Invalid+token', request.url), 303);

// El GET solo muestra el botón: cancelar es el POST
export async function GET(request: Request) {
  if (!idVerificado(request)) return linkInvalido(request);
  return paginaConfirmarAccion("¿Cancelar tu cita?", "Sí, cancelar mi cita", "#dc2626");
}

export async function POST(request: Request) {
  const id = idVerificado(request);
  if (!id) return linkInvalido(request);

  const supabase = createServiceRoleClient();

  // HU-22: solo una reserva que aún no se atiende y dentro del plazo de la barbería; avisa por correo
  const result = await cambiarReservaCliente(supabase, Number(id));
  if (!result.success) return paginaAviso("No se pudo cancelar la cita", result.error);

  // La página de resultado vive dentro de la barbería de la reserva (303: el navegador sigue con GET)
  const { data: reserva } = await supabase.from("reserva").select("id_barberia").eq("id_reserva", id).maybeSingle();
  const barberia = reserva ? await getBarberiaById(supabase, reserva.id_barberia) : null;
  return NextResponse.redirect(new URL(barberia ? `/${barberia.slug}/booking-cancelled` : "/", request.url), 303);
}
