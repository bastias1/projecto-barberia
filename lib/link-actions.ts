import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "../utils/supabase/service-role";
import { getBarberiaById } from "./barberia";
import { verifyLink, type LinkPurpose } from "./signed-links";

/**
 * Página con un botón que hace POST a la misma URL. Los links de los correos no
 * actúan con un GET: los filtros de correo abren cada link para revisarlo.
 */
export function paginaConfirmarAccion(titulo: string, boton: string, color: string): Response {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titulo}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#f4f4f5;color:#18181b">
<form method="post" style="background:#fff;padding:32px 24px;border-radius:12px;max-width:360px;width:calc(100% - 32px);text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)">
<h1 style="font-size:20px;margin:0 0 24px">${titulo}</h1>
<button type="submit" style="width:100%;padding:12px;border:0;border-radius:8px;background:${color};color:#fff;font-size:16px;font-weight:600;cursor:pointer">${boton}</button>
</form></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** Página de aviso para una acción de un link que no se pudo hacer (texto generado por el servidor). */
export function paginaAviso(titulo: string, texto: string): Response {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titulo}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#f4f4f5;color:#18181b">
<main style="background:#fff;padding:32px 24px;border-radius:12px;max-width:360px;width:calc(100% - 32px);text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)">
<h1 style="font-size:20px;margin:0 0 12px">${titulo}</h1><p style="margin:0;color:#52525b">${texto}</p>
</main></body></html>`;
  return new Response(html, { status: 409, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

const linkInvalido = (request: Request) => NextResponse.redirect(new URL("/error?message=Invalid+token", request.url), 303);

/**
 * GET y POST de un link de correo que actúa sobre una reserva (/api/confirm-booking, /api/cancel-booking).
 * El link firmado autoriza la acción: quien lo abre no tiene sesión. El GET solo muestra el botón
 * (los filtros de correo abren cada link); la acción es el POST. `ejecutar` devuelve null si salió bien
 * o la respuesta a mostrar si falló; tras el éxito se va a la página de resultado de la barbería de la
 * reserva (303: el navegador sigue con GET).
 */
export function linkAccion(cfg: {
  purpose: LinkPurpose;
  titulo: string;
  boton: string;
  color: string;
  exito: "booking-confirmed" | "booking-cancelled";
  ejecutar: (supabase: SupabaseClient, idReserva: number, request: Request) => Promise<Response | null>;
}) {
  const idVerificado = (request: Request): string | null => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    return id && verifyLink(cfg.purpose, id, searchParams.get("token")) ? id : null;
  };

  return {
    GET: async (request: Request) => (idVerificado(request) ? paginaConfirmarAccion(cfg.titulo, cfg.boton, cfg.color) : linkInvalido(request)),

    POST: async (request: Request) => {
      const id = idVerificado(request);
      if (!id) return linkInvalido(request);

      const supabase = createServiceRoleClient();
      const fallo = await cfg.ejecutar(supabase, Number(id), request);
      if (fallo) return fallo;

      const { data: reserva } = await supabase.from("reserva").select("id_barberia").eq("id_reserva", id).maybeSingle();
      const barberia = reserva ? await getBarberiaById(supabase, reserva.id_barberia) : null;
      return NextResponse.redirect(new URL(barberia ? `/${barberia.slug}/${cfg.exito}` : "/", request.url), 303);
    },
  };
}
