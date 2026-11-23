import type { SupabaseClient } from "@supabase/supabase-js";
import { Invoice, PreApproval } from "mercadopago";
import { notificarSuscripcion } from "./notifications";
import { mercadoPagoClient, registrarPagoCobro, type CobroMP } from "./pagos";
import { getSiteUrl } from "./signed-links";

/*
 * Suscripción de la barbería con Mercado Pago (preapproval = cobro mensual
 * automático). El estado en la base lo actualiza el webhook:
 * - preapproval autorizada  -> suscripción 'activa' con el plan elegido
 * - cada cobro aprobado     -> extiende fecha_termino un mes (+ días de gracia)
 * - preapproval cancelada   -> sin renovación; sigue vigente hasta fecha_termino
 * La vigencia la deciden v_barberia_modulo / barberia_limite según la fecha.
 */

export const DIAS_GRACIA = 5;

/** Mercado Pago rechaza URLs de retorno en localhost: en desarrollo se usa el dominio público. */
export function urlPublicaMP(): string {
  const site = getSiteUrl();
  return site.startsWith("http://localhost") ? "https://sunwalk.app" : site;
}

/** external_reference de la preapproval: qué suscripción y qué plan se está pagando. */
export function referenciaSuscripcion(idSuscripcion: number, idPlan: number): string {
  return `suscripcion:${idSuscripcion}:plan:${idPlan}`;
}

export function leerReferencia(ref: string | null | undefined): { idSuscripcion: number; idPlan: number } | null {
  const m = /^suscripcion:(\d+):plan:(\d+)$/.exec(ref ?? "");
  return m ? { idSuscripcion: Number(m[1]), idPlan: Number(m[2]) } : null;
}

/** "2026-10-20" + n días / + 1 mes, en formato fecha (sin zona horaria). */
function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Un mes después; el 31 de enero da el 28/29 de febrero (no el 3 de marzo). */
export function sumarMes(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.toISOString().slice(0, 10);
}

const hoy = () => new Date().toISOString().slice(0, 10);
const masTarde = (a: string | null, b: string) => (a && a > b ? a : b);

export interface PreapprovalMP {
  id?: string;
  status?: string;
  external_reference?: string;
  auto_recurring?: { transaction_amount?: number };
}

/** Aplica el estado de una preapproval (webhook subscription_preapproval). Usa service role. */
export async function aplicarPreapproval(supabase: SupabaseClient, pre: PreapprovalMP): Promise<void> {
  const ref = leerReferencia(pre.external_reference);
  if (!ref || !pre.id) return;

  const { data: sus } = await supabase
    .from("suscripcion")
    .select("id_suscripcion, id_barberia, id_suscripcion_externa, fecha_termino")
    .eq("id_suscripcion", ref.idSuscripcion)
    .maybeSingle();
  if (!sus) {
    console.error(`[suscripcion] Suscripción ${ref.idSuscripcion} no encontrada para la preapproval ${pre.id}`);
    return;
  }

  if (pre.status === "authorized") {
    const { data: plan } = await supabase.from("plan_suscripcion").select("precio_mensual").eq("id_plan", ref.idPlan).maybeSingle();
    await supabase
      .from("suscripcion")
      .update({
        estado: "activa",
        id_plan: ref.idPlan,
        precio_pactado: pre.auto_recurring?.transaction_amount ?? plan?.precio_mensual,
        id_suscripcion_externa: pre.id,
        // Mientras llega el primer cobro no se corta el servicio
        fecha_termino: sus.fecha_termino === null ? null : masTarde(sus.fecha_termino, sumarDias(hoy(), DIAS_GRACIA)),
      })
      .eq("id_suscripcion", sus.id_suscripcion);

    // Cambio de plan: la preapproval anterior deja de cobrar
    if (sus.id_suscripcion_externa && sus.id_suscripcion_externa !== pre.id) {
      try {
        await new PreApproval(mercadoPagoClient()).update({ id: sus.id_suscripcion_externa, body: { status: "cancelled" } });
      } catch (error) {
        console.error(`[suscripcion] No se pudo cancelar la preapproval anterior ${sus.id_suscripcion_externa}:`, error);
      }
    }
    return;
  }

  if ((pre.status === "cancelled" || pre.status === "paused") && sus.id_suscripcion_externa === pre.id) {
    // Sin renovación automática; si ya no le quedan días, se cancela
    const vencida = sus.fecha_termino !== null && sus.fecha_termino < hoy();
    await supabase
      .from("suscripcion")
      .update({ id_suscripcion_externa: null, ...(vencida ? { estado: "cancelada" } : {}) })
      .eq("id_suscripcion", sus.id_suscripcion);
    // El webhook puede repetirse, pero la segunda vez id_suscripcion_externa ya no coincide: un solo aviso
    await notificarSuscripcion(sus.id_barberia, "cancelada").catch((e) => console.error("[suscripcion] aviso de cancelación:", e));
  }
}

/** Registra un cobro mensual (webhook subscription_authorized_payment) y extiende la vigencia. */
export async function aplicarCobroSuscripcion(supabase: SupabaseClient, cobro: CobroMP): Promise<void> {
  if (!cobro.id || !cobro.preapproval_id) return;

  const { data: sus } = await supabase
    .from("suscripcion")
    .select("id_suscripcion, id_barberia, fecha_termino, precio_pactado")
    .eq("id_suscripcion_externa", cobro.preapproval_id)
    .maybeSingle();
  if (!sus) {
    console.error(`[suscripcion] Cobro ${cobro.id}: no hay suscripción con la preapproval ${cobro.preapproval_id}`);
    return;
  }

  const estado = await registrarPagoCobro(supabase, { ...cobro, id: cobro.id, preapproval_id: cobro.preapproval_id }, sus);

  if (estado === "aprobado") {
    // Un mes desde el cobro, más unos días de gracia por si el siguiente se atrasa
    const desde = (cobro.debit_date ?? hoy()).slice(0, 10);
    const nuevaFecha = sumarDias(sumarMes(desde), DIAS_GRACIA);
    await supabase
      .from("suscripcion")
      .update({ estado: "activa", fecha_termino: masTarde(sus.fecha_termino, nuevaFecha) })
      .eq("id_suscripcion", sus.id_suscripcion);
  }
}

/**
 * Registra los cobros de una preapproval consultándolos a Mercado Pago, por si
 * el webhook subscription_authorized_payment no llegó (en local nunca llega).
 * Idempotente: aplicarCobroSuscripcion hace upsert por cobro. Usa service role.
 */
export async function sincronizarCobros(supabase: SupabaseClient, idPreapproval: string): Promise<void> {
  try {
    const { results } = await new Invoice(mercadoPagoClient()).search({ options: { preapproval_id: idPreapproval } });
    for (const cobro of results ?? []) {
      await aplicarCobroSuscripcion(supabase, cobro as CobroMP);
    }
  } catch (error) {
    console.error(`[suscripcion] No se pudieron sincronizar los cobros de ${idPreapproval}:`, error);
  }
}
