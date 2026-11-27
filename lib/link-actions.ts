import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "../utils/supabase/service-role";
import { getBarberiaById } from "./barberia";
import { verifyLink, type LinkPurpose } from "./signed-links";

const linkInvalido = (request: Request) => NextResponse.redirect(new URL("/error?message=Invalid+token", request.url), 303);

/**
 * GET y POST de un link de correo que actúa sobre una reserva (/api/confirm-booking, /api/cancel-booking).
 * El link firmado autoriza la acción: quien lo abre no tiene sesión. El GET solo lleva a la página de la
 * cita de su barbería (/<slug>/cita), que muestra el botón (los filtros de correo abren cada link); la
 * acción es el POST de ese botón, que vuelve a la misma página (303: el navegador sigue con GET), con
 * `&error=1` si `ejecutar` no pudo.
 */
export function linkAccion(cfg: {
  purpose: LinkPurpose;
  accion: "confirmar" | "cancelar";
  ejecutar: (supabase: SupabaseClient, idReserva: number) => Promise<boolean>;
}) {
  const idVerificado = (request: Request): string | null => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    return id && verifyLink(cfg.purpose, id, searchParams.get("token")) ? id : null;
  };

  const aLaCita = async (supabase: SupabaseClient, request: Request, id: string, error = false) => {
    const { data: reserva } = await supabase.from("reserva").select("id_barberia").eq("id_reserva", id).maybeSingle();
    const barberia = reserva ? await getBarberiaById(supabase, reserva.id_barberia) : null;
    if (!barberia) return NextResponse.redirect(new URL("/", request.url), 303);
    const query = new URLSearchParams({ id, token: new URL(request.url).searchParams.get("token")!, accion: cfg.accion });
    if (error) query.set("error", "1");
    return NextResponse.redirect(new URL(`/${barberia.slug}/cita?${query}`, request.url), 303);
  };

  return {
    GET: async (request: Request) => {
      const id = idVerificado(request);
      return id ? aLaCita(createServiceRoleClient(), request, id) : linkInvalido(request);
    },

    POST: async (request: Request) => {
      const id = idVerificado(request);
      if (!id) return linkInvalido(request);
      const supabase = createServiceRoleClient();
      const ok = await cfg.ejecutar(supabase, Number(id));
      return aLaCita(supabase, request, id, !ok);
    },
  };
}
