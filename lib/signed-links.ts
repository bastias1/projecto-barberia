import crypto from "crypto";

/**
 * Links firmados (HMAC-SHA256) que se envían por correo: confirmar o cancelar
 * una reserva y dejar una reseña. El token identifica a quien recibe el correo
 * sin necesidad de iniciar sesión.
 */
export type LinkPurpose = "confirmar-reserva" | "cancelar-reserva" | "resena-reserva" | "resena-pedido";

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

export function reviewUrl(tipo: "reserva" | "pedido", id: number): string {
  const purpose: LinkPurpose = tipo === "reserva" ? "resena-reserva" : "resena-pedido";
  return `${getSiteUrl()}/resena?tipo=${tipo}&id=${id}&token=${signLink(purpose, id)}`;
}
