import type { createServiceRoleClient } from "@/utils/supabase/service-role";
import { guardarTokens, renovarTokens } from "./mercadopago-oauth";

type Admin = ReturnType<typeof createServiceRoleClient>;

/** Con menos de este margen de vigencia, el access token se renueva antes de cobrar. */
const RENOVAR_ANTES_MS = 14 * 24 * 3600_000;

/** La barbería no tiene Mercado Pago conectado (o dejó de estarlo): no se puede cobrar a su nombre. */
export class SinMercadoPago extends Error {
  constructor() {
    super("La barbería no tiene Mercado Pago conectado");
  }
}

async function leerTokens(admin: Admin, idBarberia: string) {
  const { data: fila } = await admin.from("barberia_mercadopago").select("estado, expira_at").eq("id_barberia", idBarberia).maybeSingle();
  if (!fila || fila.estado !== "conectada") throw new SinMercadoPago();
  const { data: secreto } = await admin.rpc("mp_token", { p_barberia: idBarberia });
  if (!secreto) throw new SinMercadoPago();
  const t = JSON.parse(secreto as string) as { access_token: string; refresh_token: string };
  return { access: t.access_token, refresh: t.refresh_token, expira: new Date(fila.expira_at).getTime() };
}

/**
 * Token con el que leer una notificación de la tienda: el de la barbería dueña de ese vendedor de Mercado Pago
 * (`user_id` de la notificación). `undefined` si el vendedor no es de ninguna barbería: se usa la cuenta de Sunwalk.
 */
export async function tokenDeVendedor(admin: Admin, mpUserId: unknown): Promise<string | undefined> {
  if (!Number.isSafeInteger(mpUserId)) return undefined;
  const { data } = await admin.from("barberia_mercadopago").select("id_barberia").eq("mp_user_id", mpUserId as number).maybeSingle();
  return data ? tokenBarberia(admin, data.id_barberia) : undefined;
}

/**
 * Access token de la cuenta de Mercado Pago de la barbería, renovado si está por vencer.
 * Si Mercado Pago ya no acepta la renovación (el dueño revocó el acceso) la marca `desconectada`
 * y lanza `SinMercadoPago`: el checkout se bloquea hasta que vuelva a conectar. Nunca cae a la cuenta de Sunwalk.
 */
export async function tokenBarberia(admin: Admin, idBarberia: string): Promise<string> {
  const actual = await leerTokens(admin, idBarberia);
  if (actual.expira - Date.now() > RENOVAR_ANTES_MS) return actual.access;

  try {
    const nuevos = await renovarTokens(actual.refresh);
    await guardarTokens(admin, idBarberia, nuevos);
    await admin.from("barberia_mercadopago")
      .update({ expira_at: nuevos.expiraAt.toISOString(), ultimo_error: null })
      .eq("id_barberia", idBarberia);
    return nuevos.accessToken;
  } catch (error) {
    // El refresh token rota: si otro pago renovó a la vez, el nuestro ya no sirve pero el guardado sí
    const releido = await leerTokens(admin, idBarberia).catch(() => null);
    if (releido && releido.expira > actual.expira) return releido.access;
    // Falla pasajera (red, Mercado Pago caído) con el token aún vigente: se sigue con él
    if (actual.expira > Date.now() && !String(error).includes("invalid_grant")) {
      console.error("Mercado Pago - no se pudo renovar el token:", error);
      return actual.access;
    }
    await admin.from("barberia_mercadopago")
      .update({ estado: "desconectada", ultimo_error: "Mercado Pago rechazó la renovación: hay que volver a conectar la cuenta" })
      .eq("id_barberia", idBarberia);
    throw new SinMercadoPago();
  }
}
