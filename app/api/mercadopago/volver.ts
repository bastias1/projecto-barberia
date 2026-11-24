import { NextResponse } from "next/server";

export type ResultadoMercadoPago = "ok" | "error" | "no-configurado" | "desconectado" | "en-uso";

/** Vuelve a Mi Barbería con ?mercadopago=<resultado>. El slug se valida: evita redirecciones abiertas. */
export function volverABarberia(request: Request, slug: string | null, resultado: ResultadoMercadoPago) {
  const destino = slug && /^[a-z0-9-]+$/.test(slug) ? `/${slug}/dashboard/barberia?mercadopago=${resultado}` : "/cuenta";
  return NextResponse.redirect(new URL(destino, request.url), 303);
}
