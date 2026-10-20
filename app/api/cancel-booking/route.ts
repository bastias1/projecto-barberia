import { NextResponse } from "next/server";
import { verifyLink } from "@/lib/signed-links";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { getBarberiaById } from "@/lib/barberia";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  if (!id || !token) {
    return NextResponse.redirect(new URL('/error?message=Invalid+link', request.url));
  }

  // El link firmado autoriza la acción: quien lo abre no tiene sesión
  if (!verifyLink("cancelar-reserva", id, token)) {
    return NextResponse.redirect(new URL('/error?message=Invalid+token', request.url));
  }

  const supabase = createServiceRoleClient();

  // Solo se cancela una reserva que aún no se atiende
  const { error } = await supabase
    .from("reserva")
    .update({ estado: 'cancelada' })
    .eq("id_reserva", id)
    .in("estado", ["pendiente", "confirmada"]);

  if (error) {
    console.error("Error canceling booking:", error);
    return NextResponse.redirect(new URL('/error?message=Could+not+cancel+booking', request.url));
  }

  // La página de resultado vive dentro de la barbería de la reserva
  const { data: reserva } = await supabase.from("reserva").select("id_barberia").eq("id_reserva", id).maybeSingle();
  const barberia = reserva ? await getBarberiaById(supabase, reserva.id_barberia) : null;
  return NextResponse.redirect(new URL(barberia ? `/${barberia.slug}/booking-cancelled` : "/", request.url));
}
