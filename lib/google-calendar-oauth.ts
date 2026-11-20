import { getSiteUrl, signLink, verifyLink } from "./signed-links";

/**
 * HU-24: vincular la cuenta de Google de un barbero (OAuth 2.0 con fetch, sin googleapis).
 * La sincronización de eventos está en lib/google-calendar.ts.
 */

const VIGENCIA_STATE_MS = 10 * 60_000;
const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"];

/** Sin GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET la UI oculta "Conectar". */
export function googleConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function env(nombre: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET"): string {
  const value = process.env[nombre];
  if (!value) throw new Error(`${nombre} no está configurado: Google Calendar no está disponible`);
  return value;
}

const redirectUri = () => `${getSiteUrl()}/api/google-calendar/callback`;

/** state = userId.slug.expira.firma — liga la vuelta de Google al usuario y barbería que la pidieron. */
export function crearState(userId: string, slug: string, ahora = Date.now()): string {
  const expira = ahora + VIGENCIA_STATE_MS;
  return `${userId}.${slug}.${expira}.${signLink("google-oauth", `${userId}:${slug}:${expira}`)}`;
}

export function leerState(state: string | null | undefined, ahora = Date.now()): { userId: string; slug: string } | null {
  const partes = (state ?? "").split(".");
  if (partes.length !== 4) return null;
  const [userId, slug, expira, firma] = partes;
  if (!/^\d+$/.test(expira) || Number(expira) < ahora) return null;
  if (!verifyLink("google-oauth", `${userId}:${slug}:${expira}`, firma)) return null;
  return { userId, slug };
}

export function urlAutorizacion(state: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // sin esto Google no repite el refresh token al reconectar
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Canjea el code del callback por el refresh token y el correo de la cuenta de Google. */
export async function canjearCodigo(code: string): Promise<{ refreshToken: string; email: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google rechazó el código: ${data.error ?? res.status}`);
  if (!data.refresh_token) throw new Error("Google no entregó un refresh token");
  if (!String(data.scope ?? "").includes("calendar.events")) throw new Error("No se dio permiso para el calendario");
  // El id_token viene directo de Google por TLS: basta leer su payload, sin verificar la firma
  const payload = JSON.parse(Buffer.from(String(data.id_token ?? "").split(".")[1] ?? "", "base64url").toString() || "{}");
  if (!payload.email) throw new Error("Google no entregó el correo de la cuenta");
  return { refreshToken: data.refresh_token, email: payload.email };
}

/** Revoca el token en Google. Un token ya inválido (400) cuenta como revocado. */
export async function revocarToken(token: string): Promise<void> {
  const res = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok && res.status !== 400) throw new Error(`No se pudo revocar el acceso en Google (${res.status})`);
}

/** Refresh token → access token. Un token revocado lanza `invalid_grant`. */
export async function renovarAccessToken(refreshToken: string, f: typeof fetch = fetch): Promise<string> {
  const res = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error(data?.error ?? `Google ${res.status}`);
  return data.access_token;
}
