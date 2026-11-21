import crypto from "crypto";

/**
 * Links firmados (HMAC-SHA256) que se envían por correo: confirmar o cancelar
 * una reserva y dejar una reseña. El token identifica a quien recibe el correo
 * sin necesidad de iniciar sesión.
 */
export type LinkPurpose = "confirmar-reserva" | "cancelar-reserva" | "resena-reserva" | "resena-pedido" | "google-oauth";

function secret(): string {
  const value = process.env.BOOKING_SECRET;
  if (!value) {
    throw new Error("BOOKING_SECRET no está configurado");
  }
  return value;
}

export function signLink(purpose: LinkPurpose, id: number | string): string {
  return crypto.createHmac("sha256", secret()).update(`${purpose}:${id}`).digest("hex");
}

export function verifyLink(purpose: LinkPurpose, id: number | string, token: string | null | undefined): boolean {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return false;
  const expected = Buffer.from(signLink(purpose, id), "hex");
  return crypto.timingSafeEqual(expected, Buffer.from(token, "hex"));
}

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function bookingActionUrl(action: "confirm" | "cancel", idReserva: number): string {
  const purpose: LinkPurpose = action === "confirm" ? "confirmar-reserva" : "cancelar-reserva";
  return `${getSiteUrl()}/api/${action}-booking?id=${idReserva}&token=${signLink(purpose, idReserva)}`;
}

/** HU-22: página para elegir otra hora. Usa el token de cancelar: quien puede cancelar puede reprogramar. */
export function reprogramarUrl(slug: string, idReserva: number): string {
  return `${getSiteUrl()}/${slug}/reprogramar?id=${idReserva}&token=${signLink("cancelar-reserva", idReserva)}`;
}

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

export function reviewUrl(tipo: "reserva" | "pedido", id: number): string {
  const purpose: LinkPurpose = tipo === "reserva" ? "resena-reserva" : "resena-pedido";
  return `${getSiteUrl()}/resena?tipo=${tipo}&id=${id}&token=${signLink(purpose, id)}`;
}
