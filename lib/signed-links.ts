import crypto from "crypto";

/**
 * Links firmados (HMAC-SHA256) que se envían por correo: confirmar o cancelar
 * una reserva y dejar una reseña. El token identifica a quien recibe el correo
 * sin necesidad de iniciar sesión.
 */
export type LinkPurpose = "confirmar-reserva" | "cancelar-reserva" | "resena-reserva" | "resena-pedido" | "google-oauth" | "mp-oauth";

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

/** El link de reseña de una reserva y el de un pedido se firman con propósitos distintos. */
export function purposeResena(tipo: "reserva" | "pedido"): LinkPurpose {
  return tipo === "reserva" ? "resena-reserva" : "resena-pedido";
}

export function reviewUrl(tipo: "reserva" | "pedido", id: number): string {
  return `${getSiteUrl()}/resena?tipo=${tipo}&id=${id}&token=${signLink(purposeResena(tipo), id)}`;
}
