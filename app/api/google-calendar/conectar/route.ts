import { NextRequest, NextResponse } from "next/server";
import { getStaffContext } from "@/lib/staff-context";
import { getModulosCached } from "@/lib/barberia-server";
import { crearState, googleConfigurado, urlAutorizacion } from "@/lib/google-calendar-oauth";
import { volverAConfiguracion } from "../volver";

/** HU-24: un profesional con el módulo `calendario` parte el OAuth de Google (?barberia=<slug>). */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("barberia");
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return volverAConfiguracion(request, null, "error");

  const ctx = await getStaffContext(slug);
  if (!ctx) {
    const next = `/${slug}/dashboard/configuracion`;
    return NextResponse.redirect(new URL(`/login?barberia=${slug}&next=${encodeURIComponent(next)}`, request.url));
  }
  if (!ctx.isProfesional || !(await getModulosCached(ctx.barberia.id_barberia)).includes("calendario")) {
    return volverAConfiguracion(request, slug, "error");
  }
  if (!googleConfigurado()) return volverAConfiguracion(request, slug, "no-configurado");

  return NextResponse.redirect(urlAutorizacion(crearState(ctx.userId, slug)));
}
