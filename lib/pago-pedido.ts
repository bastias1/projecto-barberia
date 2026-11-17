import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "mercadopago";
import { notificarStockBajo } from "./notifications";

type OrderResponse = Awaited<ReturnType<Order["get"]>>;

/*
 * Pagos de pedidos de la tienda con Checkout API (Orders API). Cada intento de
 * pago es una order de Mercado Pago distinta y queda como una fila de `pago`
 * (única por proveedor + id_transaccion_externa = id de la order). El trigger
 * aplicar_pago_a_pedido actualiza estado_pago del pedido y lo pasa a
 * 'confirmado' cuando se aprueba.
 */

export type EstadoPago = "aprobado" | "pendiente" | "rechazado" | "reembolsado";

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

/** Estado de un pago de Payments API (pedidos antiguos de Checkout Pro) → pago.estado */
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
export async function crearOrder(body: Record<string, unknown>): Promise<
  { ok: true; order: OrderResponse } | { ok: false; status: number; order: OrderResponse | null; errores: unknown }
> {
  const res = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN ?? ""}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, order: json as OrderResponse };
  return { ok: false, status: res.status, order: (json.data as OrderResponse) ?? null, errores: json.errors ?? json };
}

/** Registra (o actualiza) el pago de una order de Mercado Pago. Requiere el cliente service role. */
export async function registrarPagoOrder(supabase: SupabaseClient, order: OrderResponse): Promise<EstadoPago | null> {
  if (!order.id || !order.external_reference) return null;

  const { data: pedido } = await supabase
    .from("pedido")
    .select("id_pedido, id_barberia, monto_total")
    .eq("id_pedido", order.external_reference)
    .maybeSingle();

  if (!pedido) {
    console.error(`Order ${order.id}: pedido ${order.external_reference} not found`);
    return null;
  }

  const pago = order.transactions?.payments?.[0];
  const estado = estadoPagoDesdeOrder(order.status);

  const { error } = await supabase.from("pago").upsert(
    {
      id_barberia: pedido.id_barberia,
      concepto: "pedido",
      id_pedido: pedido.id_pedido,
      monto: Number(order.total_paid_amount || order.total_amount) || pedido.monto_total,
      proveedor: "mercadopago",
      id_transaccion_externa: order.id,
      estado,
      detalle: {
        status: order.status,
        status_detail: order.status_detail,
        payment_id: pago?.id,
        payment_status_detail: pago?.status_detail,
        payment_method: pago?.payment_method?.id,
        installments: pago?.payment_method?.installments,
      },
    },
    { onConflict: "proveedor,id_transaccion_externa" }
  );

  if (error) {
    console.error("Error recording order payment:", error);
    return null;
  }
  // El pago aprobado descontó stock (trigger): avisa si algún producto quedó bajo su mínimo
  if (estado === "aprobado") await notificarStockBajo(pedido.id_barberia).catch((e) => console.error("Error en alerta de stock:", e));
  return estado;
}
