import { NextRequest, NextResponse } from "next/server";
import { getStaffContext } from "@/lib/staff-context";
import { crearState, mercadoPagoOAuthConfigurado, urlAutorizacion } from "@/lib/mercadopago-oauth";
import { volverABarberia } from "../volver";

/** El admin de la barbería parte el OAuth de Mercado Pago (?barberia=<slug>). */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("barberia");
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return volverABarberia(request, null, "error");

  const ctx = await getStaffContext(slug);
  if (!ctx) {
    const next = `/${slug}/dashboard/barberia`;
    return NextResponse.redirect(new URL(`/login?barberia=${slug}&next=${encodeURIComponent(next)}`, request.url));
  }
  if (!ctx.isAdmin) return volverABarberia(request, slug, "error");
  if (!mercadoPagoOAuthConfigurado()) return volverABarberia(request, slug, "no-configurado");

  return NextResponse.redirect(urlAutorizacion(crearState(ctx.userId, slug)));
}
