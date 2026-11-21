import { NextResponse } from "next/server";

export type ResultadoCalendario = "ok" | "error" | "no-configurado" | "desconectado";

/** Vuelve a Configuración del dashboard con ?calendario=<resultado>. El slug se valida: evita redirecciones abiertas. */
export function volverAConfiguracion(request: Request, slug: string | null, resultado: ResultadoCalendario) {
  const destino = slug && /^[a-z0-9-]+$/.test(slug) ? `/${slug}/dashboard/configuracion?calendario=${resultado}` : "/cuenta";
  return NextResponse.redirect(new URL(destino, request.url), 303);
}
