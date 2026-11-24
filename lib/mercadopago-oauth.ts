import { getSiteUrl, signLink, verifyLink } from "./signed-links";
import type { createServiceRoleClient } from "@/utils/supabase/service-role";

/**
 * Cada barbería vincula su cuenta de Mercado Pago (OAuth, flujo authorization code): los pagos de la
 * tienda se cobran con su token y van a su cuenta; las suscripciones siguen en la cuenta de Sunwalk.
 * El access token dura ~180 días; el refresh token se rota en cada renovación.
 */

const VIGENCIA_STATE_MS = 10 * 60_000;
const TOKEN_URL = "https://api.mercadopago.com/oauth/token";

/** Sin MERCADOPAGO_CLIENT_ID / MERCADOPAGO_CLIENT_SECRET la UI oculta "Conectar". */
export function mercadoPagoOAuthConfigurado(): boolean {
  return Boolean(process.env.MERCADOPAGO_CLIENT_ID && process.env.MERCADOPAGO_CLIENT_SECRET);
}

function env(nombre: "MERCADOPAGO_CLIENT_ID" | "MERCADOPAGO_CLIENT_SECRET"): string {
  const value = process.env[nombre];
  if (!value) throw new Error(`${nombre} no está configurado: no se puede vincular Mercado Pago`);
  return value;
}

/** Debe coincidir exactamente con la URL de redireccionamiento registrada en la aplicación de Mercado Pago. */
const redirectUri = () => `${getSiteUrl()}/api/mercadopago/callback`;

/** state = userId.slug.expira.firma — liga la vuelta de Mercado Pago al usuario y barbería que la pidieron. */
export function crearState(userId: string, slug: string, ahora = Date.now()): string {
  const expira = ahora + VIGENCIA_STATE_MS;
  return `${userId}.${slug}.${expira}.${signLink("mp-oauth", `${userId}:${slug}:${expira}`)}`;
}

export function leerState(state: string | null | undefined, ahora = Date.now()): { userId: string; slug: string } | null {
  const partes = (state ?? "").split(".");
  if (partes.length !== 4) return null;
  const [userId, slug, expira, firma] = partes;
  if (!/^\d+$/.test(expira) || Number(expira) < ahora) return null;
  if (!verifyLink("mp-oauth", `${userId}:${slug}:${expira}`, firma)) return null;
  return { userId, slug };
}

export function urlAutorizacion(state: string): string {
  const params = new URLSearchParams({
    client_id: env("MERCADOPAGO_CLIENT_ID"),
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: redirectUri(),
  });
  return `https://auth.mercadopago.com/authorization?${params}`;
}

export interface TokensMP {
  accessToken: string;
  refreshToken: string;
  expiraAt: Date;
  /** Id del vendedor en Mercado Pago. */
  userId: number;
}

async function pedirToken(body: Record<string, string>): Promise<TokensMP> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env("MERCADOPAGO_CLIENT_ID"), client_secret: env("MERCADOPAGO_CLIENT_SECRET"), ...body }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new Error(`Mercado Pago rechazó la solicitud de token: ${data.error ?? res.status}`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiraAt: new Date(Date.now() + Number(data.expires_in) * 1000),
    userId: Number(data.user_id),
  };
}

/** Canjea el code del callback por los tokens del vendedor. */
export const canjearCodigo = (code: string) =>
  pedirToken({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });

/** Renueva con el refresh token. Un acceso revocado lanza `invalid_grant`. */
export const renovarTokens = (refreshToken: string) =>
  pedirToken({ refresh_token: refreshToken, grant_type: "refresh_token" });

/** Nombre de la cuenta para mostrar "conectado como …"; null si Mercado Pago no responde (no es crítico). */
export async function nombreDeCuenta(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  const cuenta = res?.ok ? await res.json().catch(() => null) : null;
  return cuenta?.nickname ?? cuenta?.email ?? null;
}

/** Guarda access y refresh token en Vault (un solo secreto por barbería); devuelve el id del secreto. */
export async function guardarTokens(
  admin: ReturnType<typeof createServiceRoleClient>,
  idBarberia: string,
  t: Pick<TokensMP, "accessToken" | "refreshToken">,
): Promise<string> {
  const { data, error } = await admin.rpc("mp_guardar_token", {
    p_barberia: idBarberia,
    p_token: JSON.stringify({ access_token: t.accessToken, refresh_token: t.refreshToken }),
  });
  if (error) throw error;
  return data as string;
}
