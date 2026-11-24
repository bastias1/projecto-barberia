import type { SupabaseClient } from "@supabase/supabase-js";
import { Invoice, PreApproval } from "mercadopago";
import { DEFAULT_TZ } from "./barberia";
import { todayIn } from "./datetime";
import { notificarSuscripcion } from "./notifications";
import { mercadoPagoClient, registrarPagoCobro, type CobroMP } from "./pagos";
import { MONTO_MINIMO_SUSCRIPCION } from "./planes";
import { getSiteUrl } from "./signed-links";

/*
 * Suscripción de la barbería con Mercado Pago (preapproval = cobro mensual
 * automático). Este módulo es el único dueño de su ciclo de vida:
 * - estadoSuscripcion       -> la regla de vigencia (fecha de Chile, como la BD)
 * - ultimaSuscripcion       -> la consulta de "la suscripción vigente" de una barbería
 * - transiciones            -> suscribir, aplicarPreapproval, aplicarCobroSuscripcion, cancelar,
 *                              extenderVigencia, cambiarPlan, activarCortesia, eliminarSuscripcion
 * El estado en la base lo actualiza el webhook o, sin él, estas mismas transiciones:
 * - preapproval autorizada  -> suscripción 'activa' con el plan elegido
 * - cada cobro aprobado     -> extiende fecha_termino un mes (+ días de gracia)
 * - preapproval cancelada   -> sin renovación; sigue vigente hasta fecha_termino
 * La vigencia la deciden v_barberia_modulo / barberia_limite según la fecha.
 * Mercado Pago, el aviso por correo y "hoy" entran por `OpcionesSuscripcion` (con valores reales
 * por defecto) para poder probar las transiciones sin red.
 */

export const DIAS_GRACIA = 5;

// ---------------------------------------------------------------- tipos y adapters

export interface PreapprovalMP {
  id?: string;
  status?: string;
  external_reference?: string;
  auto_recurring?: { transaction_amount?: number };
}

export type CuerpoPreapproval = Parameters<PreApproval["create"]>[0]["body"];

/** Lo que el módulo necesita de Mercado Pago. */
export interface PasarelaSuscripcion {
  crear(body: CuerpoPreapproval): Promise<PreapprovalMP>;
  cancelar(idPreapproval: string): Promise<void>;
  cobros(idPreapproval: string): Promise<CobroMP[]>;
}

export const pasarelaMercadoPago: PasarelaSuscripcion = {
  crear: async (body) => (await new PreApproval(mercadoPagoClient()).create({ body })) as PreapprovalMP,
  cancelar: async (id) => {
    await new PreApproval(mercadoPagoClient()).update({ id, body: { status: "cancelled" } });
  },
  cobros: async (id) => {
    const { results } = await new Invoice(mercadoPagoClient()).search({ options: { preapproval_id: id } });
    return (results ?? []) as CobroMP[];
  },
};

export interface OpcionesSuscripcion {
  pasarela?: PasarelaSuscripcion;
  avisar?: typeof notificarSuscripcion;
  /** Fecha YYYY-MM-DD de "hoy" en Chile; por defecto la real. */
  hoy?: string;
}

const hoyDe = (o?: OpcionesSuscripcion) => o?.hoy ?? todayIn(DEFAULT_TZ);

export type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string; status: number };
const falla = (error: string, status: number) => ({ ok: false as const, error, status });

export interface SuscripcionFila {
  id_suscripcion: number;
  id_barberia: string;
  id_plan: number;
  estado: string;
  fecha_inicio: string;
  fecha_termino: string | null;
  precio_pactado: number;
  id_suscripcion_externa: string | null;
}

const COLUMNAS = "id_suscripcion, id_barberia, id_plan, estado, fecha_inicio, fecha_termino, precio_pactado, id_suscripcion_externa";

// ---------------------------------------------------------------- lectura y vigencia

/** La suscripción más reciente de la barbería; `conCobro`: la más reciente que tenga renovación automática. */
export async function ultimaSuscripcion(
  supabase: SupabaseClient,
  idBarberia: string,
  { conCobro = false }: { conCobro?: boolean } = {},
): Promise<SuscripcionFila | null> {
  let q = supabase.from("suscripcion").select(COLUMNAS).eq("id_barberia", idBarberia);
  if (conCobro) q = q.not("id_suscripcion_externa", "is", null);
  const { data } = await q.order("id_suscripcion", { ascending: false }).limit(1).maybeSingle();
  return (data as SuscripcionFila | null) ?? null;
}

export type ClaveEstado = "suspendida" | "sin" | "vencida" | "prueba" | "activa_mp" | "cortesia" | "activa";

/**
 * Clasifica la suscripción. Vigente = estado prueba/activa y fecha_termino nula o no pasada,
 * con "hoy" en Chile: igual que la base de datos. Los textos los pone quien la muestre.
 */
export function estadoSuscripcion(
  sus: Pick<SuscripcionFila, "estado" | "fecha_termino" | "id_suscripcion_externa"> | null,
  { barberiaActiva = true, hoy = todayIn(DEFAULT_TZ) }: { barberiaActiva?: boolean; hoy?: string } = {},
): { clave: ClaveEstado; vigente: boolean } {
  if (!barberiaActiva) return { clave: "suspendida", vigente: false };
  if (!sus) return { clave: "sin", vigente: false };
  const vencida = (sus.fecha_termino !== null && sus.fecha_termino < hoy) || !["prueba", "activa"].includes(sus.estado);
  if (vencida) return { clave: "vencida", vigente: false };
  if (sus.estado === "prueba") return { clave: "prueba", vigente: true };
  if (sus.id_suscripcion_externa) return { clave: "activa_mp", vigente: true };
  return { clave: sus.fecha_termino ? "cortesia" : "activa", vigente: true };
}

// ---------------------------------------------------------------- fechas y referencias

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

const masTarde = (a: string | null, b: string) => (a && a > b ? a : b);

// ---------------------------------------------------------------- transiciones

/**
 * Corta la renovación automática (la suscripción sigue vigente hasta fecha_termino; si ya no le
 * quedan días pasa a 'cancelada') y avisa al dueño. Es la única salida: la usan el dueño y el
 * webhook. Solo quien logra soltar la referencia avisa, así que un segundo intento no repite el correo.
 */
async function cortarRenovacion(
  supabase: SupabaseClient,
  sus: Pick<SuscripcionFila, "id_suscripcion" | "id_barberia" | "fecha_termino"> & { id_suscripcion_externa: string },
  opts?: OpcionesSuscripcion,
): Promise<void> {
  const vencida = sus.fecha_termino !== null && sus.fecha_termino < hoyDe(opts);
  const { data } = await supabase
    .from("suscripcion")
    .update({ id_suscripcion_externa: null, ...(vencida ? { estado: "cancelada" } : {}) })
    .eq("id_suscripcion", sus.id_suscripcion)
    .eq("id_suscripcion_externa", sus.id_suscripcion_externa)
    .select("id_suscripcion");
  if (!data?.length) return;
  await (opts?.avisar ?? notificarSuscripcion)(sus.id_barberia, "cancelada").catch((e) => console.error("[suscripcion] aviso de cancelación:", e));
}

/** Aplica el estado de una preapproval (webhook subscription_preapproval). Usa service role. */
export async function aplicarPreapproval(supabase: SupabaseClient, pre: PreapprovalMP, opts?: OpcionesSuscripcion): Promise<void> {
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
        fecha_termino: sus.fecha_termino === null ? null : masTarde(sus.fecha_termino, sumarDias(hoyDe(opts), DIAS_GRACIA)),
      })
      .eq("id_suscripcion", sus.id_suscripcion);

    // Cambio de plan: la preapproval anterior deja de cobrar
    if (sus.id_suscripcion_externa && sus.id_suscripcion_externa !== pre.id) {
      try {
        await (opts?.pasarela ?? pasarelaMercadoPago).cancelar(sus.id_suscripcion_externa);
      } catch (error) {
        console.error(`[suscripcion] No se pudo cancelar la preapproval anterior ${sus.id_suscripcion_externa}:`, error);
      }
    }
    return;
  }

  if ((pre.status === "cancelled" || pre.status === "paused") && sus.id_suscripcion_externa === pre.id) {
    await cortarRenovacion(supabase, { ...sus, id_suscripcion_externa: pre.id }, opts);
  }
}

/** Registra un cobro mensual (webhook subscription_authorized_payment) y extiende la vigencia. */
export async function aplicarCobroSuscripcion(supabase: SupabaseClient, cobro: CobroMP, opts?: OpcionesSuscripcion): Promise<void> {
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
    const desde = (cobro.debit_date ?? hoyDe(opts)).slice(0, 10);
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
export async function sincronizarCobros(supabase: SupabaseClient, idPreapproval: string, opts?: OpcionesSuscripcion): Promise<void> {
  try {
    for (const cobro of await (opts?.pasarela ?? pasarelaMercadoPago).cobros(idPreapproval)) {
      await aplicarCobroSuscripcion(supabase, cobro, opts);
    }
  } catch (error) {
    console.error(`[suscripcion] No se pudieron sincronizar los cobros de ${idPreapproval}:`, error);
  }
}

/** Mensaje para el dueño según el error de Mercado Pago al crear la preapproval. */
function mensajeTarjeta(mensaje: string): string {
  // Tarjetas con CVV opcional (p. ej. la Mastercard de prueba de Chile): el token puede salir sin CVV
  if (/without cvv/i.test(mensaje)) {
    return "Esta tarjeta no envió el código de seguridad, que es obligatorio para el cobro mensual. Recarga la página e ingrésalo, o usa otra tarjeta.";
  }
  if (/token was used/i.test(mensaje)) return "La validación de la tarjeta expiró. Vuelve a intentar el pago.";
  // CC_VAL_433: Mercado Pago no validó la tarjeta (las de débito se rechazan para cobros recurrentes)
  if (/CC_VAL_433/i.test(mensaje)) return "Mercado Pago no pudo validar la tarjeta para el cobro mensual. Usa una tarjeta de crédito.";
  return "Mercado Pago rechazó la tarjeta. Revisa los datos o usa otra tarjeta.";
}

/**
 * Suscribe la barbería a un plan con la tarjeta tokenizada (preapproval autorizada, sin redirigir a
 * Mercado Pago). Se aplica al tiro; el webhook lo repite y registra los cobros. Usa service role.
 */
export async function suscribir(
  supabase: SupabaseClient,
  datos: { barberia: { id_barberia: string; nombre: string; slug: string }; email: string; idPlan: number; token: string },
  opts?: OpcionesSuscripcion,
): Promise<Resultado<{ estado: string }>> {
  const [{ data: plan }, sus] = await Promise.all([
    supabase.from("plan_suscripcion").select("id_plan, nombre, precio_mensual").eq("id_plan", datos.idPlan).eq("activo", true).maybeSingle(),
    ultimaSuscripcion(supabase, datos.barberia.id_barberia),
  ]);

  if (!plan) return falla("Elige un plan válido", 400);
  if (!sus) return falla("La barbería no tiene una suscripción registrada", 404);
  if (sus.estado === "activa" && sus.id_suscripcion_externa && sus.id_plan === plan.id_plan) {
    return falla(`Ya estás pagando el plan ${plan.nombre}`, 409);
  }
  if (Number(plan.precio_mensual) < MONTO_MINIMO_SUSCRIPCION) {
    return falla(`Mercado Pago no permite cobros menores a $${MONTO_MINIMO_SUSCRIPCION}`, 400);
  }

  const pasarela = opts?.pasarela ?? pasarelaMercadoPago;
  let preapproval: PreapprovalMP;
  try {
    preapproval = await pasarela.crear({
      reason: `Plan ${plan.nombre} · ${datos.barberia.nombre}`,
      external_reference: referenciaSuscripcion(sus.id_suscripcion, plan.id_plan),
      // Con credenciales de prueba el pagador también debe ser un usuario de prueba
      payer_email: process.env.MERCADOPAGO_TEST_PAYER_EMAIL || datos.email,
      card_token_id: datos.token,
      back_url: `${urlPublicaMP()}/${datos.barberia.slug}/dashboard/suscripcion`,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: Number(plan.precio_mensual), currency_id: "CLP" },
      status: "authorized",
    });
  } catch (error) {
    // Las preapprovals traen el motivo en `message` (tarjeta rechazada, datos inválidos…)
    console.error("Suscripción - error creando la preapproval:", error);
    return falla(mensajeTarjeta(error instanceof Error ? error.message : ""), 402);
  }

  if (preapproval.status !== "authorized") {
    console.error(`Suscripción - preapproval ${preapproval.id} quedó en estado ${preapproval.status}`);
    return falla("Mercado Pago no autorizó el cobro con esta tarjeta. Usa otra tarjeta.", 402);
  }

  // Activa el plan y, si es un cambio, cancela la preapproval anterior
  await aplicarPreapproval(supabase, preapproval, opts);
  // El primer cobro se genera al crearla: se registra sin esperar al webhook
  if (preapproval.id) await sincronizarCobros(supabase, preapproval.id, opts);
  return { ok: true, estado: preapproval.status };
}

/** El dueño detiene la renovación automática; sigue vigente hasta fecha_termino. Usa service role. */
export async function cancelar(supabase: SupabaseClient, idBarberia: string, opts?: OpcionesSuscripcion): Promise<Resultado> {
  const sus = await ultimaSuscripcion(supabase, idBarberia, { conCobro: true });
  if (!sus?.id_suscripcion_externa) return falla("No hay un cobro automático activo", 404);

  try {
    await (opts?.pasarela ?? pasarelaMercadoPago).cancelar(sus.id_suscripcion_externa);
  } catch (error) {
    console.error("Suscripción - error cancelando la preapproval:", error);
    return falla("Mercado Pago no pudo cancelar el cobro. Intenta nuevamente.", 502);
  }

  await cortarRenovacion(supabase, { ...sus, id_suscripcion_externa: sus.id_suscripcion_externa }, opts);
  return { ok: true };
}

// ---- Acciones del superadmin: corren con su sesión (RLS *_superadmin) y devuelven antes/después para la bitácora.

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const SIN_SUSCRIPCION = "La barbería no tiene suscripción";

type Cambio = Resultado<{ antes: Record<string, unknown>; despues: Record<string, unknown> }>;

/** Nueva fecha de término (prueba o suscripción). Si estaba vencida o cancelada, vuelve a activa. */
export async function extenderVigencia(supabase: SupabaseClient, idBarberia: string, fecha: string): Promise<Cambio> {
  if (!FECHA.test(fecha)) return falla("Fecha inválida", 400);
  const sus = await ultimaSuscripcion(supabase, idBarberia);
  if (!sus) return falla(SIN_SUSCRIPCION, 404);

  const estado = sus.estado === "vencida" || sus.estado === "cancelada" ? "activa" : sus.estado;
  const { error } = await supabase.from("suscripcion").update({ fecha_termino: fecha, estado }).eq("id_suscripcion", sus.id_suscripcion);
  if (error) return falla(error.message, 500);
  return { ok: true, antes: { fecha_termino: sus.fecha_termino, estado: sus.estado }, despues: { fecha_termino: fecha, estado } };
}

/** Cambia el plan (y su precio pactado). El cobro de Mercado Pago no cambia hasta que el dueño vuelva a pagar. */
export async function cambiarPlan(supabase: SupabaseClient, idBarberia: string, idPlan: number): Promise<Cambio> {
  const [sus, { data: plan }] = await Promise.all([
    ultimaSuscripcion(supabase, idBarberia),
    supabase.from("plan_suscripcion").select("id_plan, nombre, precio_mensual").eq("id_plan", idPlan).maybeSingle(),
  ]);
  if (!sus) return falla(SIN_SUSCRIPCION, 404);
  if (!plan) return falla("Plan no encontrado", 404);

  const { error } = await supabase
    .from("suscripcion")
    .update({ id_plan: plan.id_plan, precio_pactado: plan.precio_mensual })
    .eq("id_suscripcion", sus.id_suscripcion);
  if (error) return falla(error.message, 500);
  return {
    ok: true,
    antes: { id_plan: sus.id_plan, precio_pactado: sus.precio_pactado },
    despues: { id_plan: plan.id_plan, plan: plan.nombre, precio_pactado: plan.precio_mensual },
  };
}

/** Cancela el cobro automático (si hay) y deja la suscripción 'cancelada': la barbería pierde los módulos ya. El historial de pagos queda. */
export async function eliminarSuscripcion(supabase: SupabaseClient, idBarberia: string, opts?: OpcionesSuscripcion): Promise<Cambio> {
  const sus = await ultimaSuscripcion(supabase, idBarberia);
  if (!sus) return falla(SIN_SUSCRIPCION, 404);
  if (sus.estado === "cancelada" && !sus.id_suscripcion_externa) return falla("La suscripción ya está cancelada", 409);

  if (sus.id_suscripcion_externa) {
    try {
      await (opts?.pasarela ?? pasarelaMercadoPago).cancelar(sus.id_suscripcion_externa);
    } catch (error) {
      console.error("Suscripción - error cancelando la preapproval:", error);
      return falla("Mercado Pago no pudo cancelar el cobro. Intenta nuevamente.", 502);
    }
  }

  const { error } = await supabase
    .from("suscripcion")
    .update({ estado: "cancelada", id_suscripcion_externa: null })
    .eq("id_suscripcion", sus.id_suscripcion);
  if (error) return falla(error.message, 500);
  return {
    ok: true,
    antes: { estado: sus.estado, fecha_termino: sus.fecha_termino, cobro_automatico: !!sus.id_suscripcion_externa },
    despues: { estado: "cancelada", fecha_termino: sus.fecha_termino, cobro_automatico: false },
  };
}

/** Suscripción activa sin cobro (fecha opcional: sin fecha = indefinida). */
export async function activarCortesia(supabase: SupabaseClient, idBarberia: string, fecha: string | null): Promise<Cambio> {
  if (fecha && !FECHA.test(fecha)) return falla("Fecha inválida", 400);
  const sus = await ultimaSuscripcion(supabase, idBarberia);
  if (!sus) return falla(SIN_SUSCRIPCION, 404);
  // Si se borrara la referencia, Mercado Pago seguiría cobrando sin que la app lo sepa
  if (sus.id_suscripcion_externa) {
    return falla("Tiene un cobro automático en Mercado Pago. El dueño debe cancelarlo antes de pasar a cortesía.", 409);
  }

  const { error } = await supabase.from("suscripcion").update({ estado: "activa", fecha_termino: fecha }).eq("id_suscripcion", sus.id_suscripcion);
  if (error) return falla(error.message, 500);
  return { ok: true, antes: { estado: sus.estado, fecha_termino: sus.fecha_termino }, despues: { estado: "activa", fecha_termino: fecha } };
}
