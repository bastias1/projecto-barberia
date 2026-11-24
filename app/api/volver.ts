import { NextResponse } from "next/server";

/** Vuelve a `/<slug>/dashboard/<pagina>` tras un flujo OAuth. El slug se valida: evita redirecciones abiertas. */
export function volverAlDashboard(request: Request, slug: string | null, pagina: string) {
  const destino = slug && /^[a-z0-9-]+$/.test(slug) ? `/${slug}/dashboard/${pagina}` : "/cuenta";
  return NextResponse.redirect(new URL(destino, request.url), 303);
}
