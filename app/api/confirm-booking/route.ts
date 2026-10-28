import { NextResponse } from "next/server";
import { paginaConfirmarAccion, verifyLink } from "@/lib/signed-links";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { getBarberiaById } from "@/lib/barberia";

// El link firmado autoriza la acción: quien lo abre no tiene sesión
function idVerificado(request: Request): string | null {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  return id && verifyLink("confirmar-reserva", id, searchParams.get("token")) ? id : null;
}

const linkInvalido = (request: Request) => NextResponse.redirect(new URL('/error?message=Invalid+token', request.url), 303);

// El GET solo muestra el botón: confirmar es el POST
export async function GET(request: Request) {
  if (!idVerificado(request)) return linkInvalido(request);
  return paginaConfirmarAccion("¿Confirmas tu cita?", "Sí, confirmar mi cita", "#16a34a");
}

export async function POST(request: Request) {
  const id = idVerificado(request);
  if (!id) return linkInvalido(request);

  const supabase = createServiceRoleClient();

  // Solo se confirma una reserva que sigue pendiente
  const { error } = await supabase
    .from("reserva")
    .update({ estado: 'confirmada' })
    .eq("id_reserva", id)
    .eq("estado", "pendiente");

  if (error) {
    console.error("Error confirming booking:", error);
    return NextResponse.redirect(new URL('/error?message=Could+not+confirm+booking', request.url), 303);
  }

  // La página de resultado vive dentro de la barbería de la reserva (303: el navegador sigue con GET)
  const { data: reserva } = await supabase.from("reserva").select("id_barberia").eq("id_reserva", id).maybeSingle();
  const barberia = reserva ? await getBarberiaById(supabase, reserva.id_barberia) : null;
  return NextResponse.redirect(new URL(barberia ? `/${barberia.slug}/booking-confirmed` : "/", request.url), 303);
}
