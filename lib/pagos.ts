import type { SupabaseClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, type Order, type Payment } from "mercadopago";
import { notificarPedidoPagado, notificarStockBajo, notificarSuscripcion } from "./notifications";

type OrderResponse = Awaited<ReturnType<Order["get"]>>;
type PaymentResponse = Awaited<ReturnType<Payment["get"]>>;

/*
 * Pagos con Mercado Pago, de una sola vía hacia la tabla `pago`: pedidos de la tienda
 * (Orders API, y Payments API en pedidos antiguos de Checkout Pro) y cobros de la
 * suscripción. Cada transacción es una fila única por proveedor + id_transaccion_externa
 * (constraint pago_transaccion_unica), así que registrar dos veces es inocuo. El trigger
 * aplicar_pago_a_pedido actualiza estado_pago del pedido, lo pasa a 'confirmado' al
 * aprobarse y descuenta el stock.
 */

export type EstadoPago = "aprobado" | "pendiente" | "rechazado" | "reembolsado";

/** Sin argumento, el cliente de Sunwalk (suscripciones); con el token de una barbería, el de su cuenta (tienda). */
export function mercadoPagoClient(accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "") {
  return new MercadoPagoConfig({ accessToken });
}

/** Estado de la order (o de su transacción) → pago.estado */
export function estadoPagoDesdeOrder(status: string | undefined): EstadoPago {
  switch (status) {
    case "processed":
      return "aprobado";
    case "refunded":
    case "charged_back":
      return "reembolsado";
    case "failed":
    case "canceled":
    case "expired":
      return "rechazado";
    default: // created, action_required, processing
      return "pendiente";
  }
}

/** Estado de un pago de Payments API (Checkout Pro y cobros de suscripción) → pago.estado */
export function estadoPagoDesdePayment(status: string | undefined): EstadoPago {
  if (status === "approved") return "aprobado";
  if (status === "rejected" || status === "cancelled") return "rechazado";
  if (status === "refunded" || status === "charged_back") return "reembolsado";
  return "pendiente";
}

/** Mensaje para el comprador según el status_detail de una order fallida. */
export function mensajeRechazo(statusDetail: string | undefined): string {
  switch (statusDetail) {
    case "insufficient_amount":
      return "La tarjeta no tiene fondos suficientes.";
    case "bad_filled_card_data":
      return "Revisa los datos de la tarjeta.";
    case "invalid_card_token":
      return "La sesión de pago expiró. Ingresa la tarjeta nuevamente.";
    case "card_disabled":
      return "La tarjeta está deshabilitada. Usa otra tarjeta.";
    case "amount_limit_exceeded":
      return "El monto supera el límite de la tarjeta.";
    case "required_call_for_authorize":
      return "Tu banco requiere que autorices el pago. Llámalos e intenta de nuevo.";
    case "max_attempts_exceeded":
      return "Hiciste demasiados intentos con esta tarjeta. Espera un rato o usa otra tarjeta.";
    case "high_risk":
      return "El pago fue rechazado. Usa otra tarjeta.";
    default:
      return "El pago fue rechazado. Intenta con otra tarjeta.";
  }
}

/*
 * Crea una order con la API REST: el SDK descarta el detalle de los errores
 * (`errors[]`) y, en un 402 (order creada pero el pago falló), también la order.
 */
export async function crearOrder(accessToken: string, body: Record<string, unknown>, idempotencyKey: string, deviceId?: string): Promise<
  { ok: true; order: OrderResponse } | { ok: false; status: number; order: OrderResponse | null; errores: unknown }
> {
  const res = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
      // Device ID del comprador (lo genera MercadoPago.js): mejora la aprobación y la seguridad
      ...(deviceId ? { "X-meli-session-id": deviceId } : {}),
      // Identificador de plataforma que entrega Mercado Pago; sin él no se envía
      ...(process.env.MERCADOPAGO_PLATFORM_ID ? { "X-Platform-Id": process.env.MERCADOPAGO_PLATFORM_ID } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, order: json as OrderResponse };
  return { ok: false, status: res.status, order: (json.data as OrderResponse) ?? null, errores: json.errors ?? json };
}

interface PagoNuevo {
  idBarberia: string;
  concepto: "pedido" | "suscripcion";
  idPedido?: number;
  idSuscripcion?: number;
  monto: number;
  /** Id de la transacción en Mercado Pago: la clave de idempotencia junto con el proveedor. */
  idTransaccion: string;
  estado: EstadoPago;
  detalle: Record<string, unknown>;
}

/**
 * Registra (o actualiza) un pago de Mercado Pago. Requiere el cliente service role.
 * Tras aprobar un pedido avisa si algún producto quedó bajo su stock mínimo.
 * Devuelve false si no se pudo guardar (el error queda en el log).
 */
export async function registrarPago(supabase: SupabaseClient, p: PagoNuevo): Promise<boolean> {
  // La respuesta síncrona y el webhook registran el mismo pago: el correo sale solo cuando cambia el estado
  const { data: previo } = await supabase.from("pago").select("estado").eq("proveedor", "mercadopago").eq("id_transaccion_externa", p.idTransaccion).maybeSingle();
  const cambio = previo?.estado !== p.estado;
  const { error } = await supabase.from("pago").upsert(
    {
      id_barberia: p.idBarberia,
      concepto: p.concepto,
      id_pedido: p.idPedido,
      id_suscripcion: p.idSuscripcion,
      monto: p.monto,
      proveedor: "mercadopago",
      id_transaccion_externa: p.idTransaccion,
      estado: p.estado,
      detalle: p.detalle,
    },
    { onConflict: "proveedor,id_transaccion_externa" }
  );
  if (error) {
    console.error(`[pagos] No se pudo registrar el pago ${p.idTransaccion}:`, error);
    return false;
  }
  if (p.concepto === "pedido" && p.estado === "aprobado") {
    await notificarStockBajo(p.idBarberia).catch((e) => console.error("Error en alerta de stock:", e));
    if (cambio && p.idPedido) await notificarPedidoPagado(p.idPedido).catch((e) => console.error("Error en comprobante:", e));
  }
  if (p.concepto === "suscripcion" && p.estado === "rechazado" && cambio) {
    await notificarSuscripcion(p.idBarberia, "cobro_rechazado").catch((e) => console.error("Error en aviso de cobro:", e));
  }
  return true;
}

async function buscarPedido(supabase: SupabaseClient, ref: string, origen: string) {
  const { data } = await supabase.from("pedido").select("id_pedido, id_barberia, monto_total").eq("id_pedido", ref).maybeSingle();
  if (!data) console.error(`${origen}: pedido ${ref} not found`);
  return data;
}

/**
 * Registra el pago de una order de la tienda (Orders API).
 * `idBarberiaEsperada`: la barbería de cuyo token se leyó la order; si el pedido es de otra, no se registra
 * (el cuerpo del webhook no va firmado, así que el vendedor que informa no es de fiar por sí solo).
 */
export async function registrarPagoOrder(supabase: SupabaseClient, order: OrderResponse, idBarberiaEsperada?: string): Promise<EstadoPago | null> {
  if (!order.id || !order.external_reference) return null;
  const pedido = await buscarPedido(supabase, order.external_reference, `Order ${order.id}`);
  if (!pedido) return null;
  if (idBarberiaEsperada && pedido.id_barberia !== idBarberiaEsperada) {
    console.error(`Order ${order.id}: el pedido ${pedido.id_pedido} es de otra barbería, no se registra`);
    return null;
  }
  // El trigger da el pedido por pagado con cualquier pago aprobado: el total cobrado debe ser el del pedido (CLP, sin decimales)
  if (Math.round(Number(order.total_amount)) !== Math.round(Number(pedido.monto_total))) {
    console.error(`Order ${order.id}: total ${order.total_amount} distinto del pedido ${pedido.id_pedido} (${pedido.monto_total}), no se registra`);
    return null;
  }

  const pago = order.transactions?.payments?.[0];
  const estado = estadoPagoDesdeOrder(order.status);
  const guardado = await registrarPago(supabase, {
    idBarberia: pedido.id_barberia,
    concepto: "pedido",
    idPedido: pedido.id_pedido,
    monto: Number(order.total_paid_amount || order.total_amount) || pedido.monto_total,
    idTransaccion: order.id,
    estado,
    detalle: {
      status: order.status,
      status_detail: order.status_detail,
      payment_id: pago?.id,
      payment_status_detail: pago?.status_detail,
      payment_method: pago?.payment_method?.id,
      installments: pago?.payment_method?.installments,
    },
  });
  return guardado ? estado : null;
}

/** Registra el pago de un pedido antiguo pagado con Checkout Pro (Payments API). */
export async function registrarPagoPayment(supabase: SupabaseClient, payment: PaymentResponse): Promise<EstadoPago | null> {
  if (!payment.id || !payment.external_reference) return null;
  const pedido = await buscarPedido(supabase, payment.external_reference, `Payment ${payment.id}`);
  if (!pedido) return null;

  const estado = estadoPagoDesdePayment(payment.status);
  const guardado = await registrarPago(supabase, {
    idBarberia: pedido.id_barberia,
    concepto: "pedido",
    idPedido: pedido.id_pedido,
    monto: payment.transaction_amount ?? pedido.monto_total,
    idTransaccion: String(payment.id),
    estado,
    detalle: {
      status: payment.status,
      status_detail: payment.status_detail,
      payment_method: payment.payment_method_id,
      installments: payment.installments,
    },
  });
  return guardado ? estado : null;
}

/** Cobro mensual de una preapproval (Invoice de Mercado Pago). */
export interface CobroMP {
  id?: string | number;
  preapproval_id?: string;
  status?: string;
  debit_date?: string;
  transaction_amount?: number;
  payment?: { id?: string | number; status?: string; status_detail?: string };
}

/** Registra un cobro de la suscripción y devuelve su estado (aprobarlo extiende la vigencia, ver lib/suscripcion.ts). */
export async function registrarPagoCobro(
  supabase: SupabaseClient,
  cobro: CobroMP & { id: string | number; preapproval_id: string },
  sus: { id_suscripcion: number; id_barberia: string; precio_pactado: number },
): Promise<EstadoPago> {
  const estado = estadoPagoDesdePayment(cobro.payment?.status);
  await registrarPago(supabase, {
    idBarberia: sus.id_barberia,
    concepto: "suscripcion",
    idSuscripcion: sus.id_suscripcion,
    monto: cobro.transaction_amount ?? sus.precio_pactado,
    idTransaccion: `cobro-${cobro.id}`,
    estado,
    detalle: { preapproval_id: cobro.preapproval_id, payment_id: cobro.payment?.id, status: cobro.payment?.status, status_detail: cobro.payment?.status_detail },
  });
  return estado;
}
