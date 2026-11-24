/**
 * Cuerpo de la order de la tienda (Orders API) con los datos que Mercado Pago mide en la calidad de la
 * integración y usa contra el fraude: ítems, comprador y descriptor del resumen de tarjeta.
 */

/**
 * Rubro de los ítems. Mercado Pago solo pide que se envíe (admite una etiqueta o un código); no encontré
 * una lista de valores en la documentación, así que es una etiqueta razonable para productos de barbería.
 */
const CATEGORIA_ITEMS = "beauty";

/** Largo máximo del descriptor: el habitual de los resúmenes de tarjeta (Mercado Pago no publica el de Chile). */
const LARGO_DESCRIPTOR = 22;

/** Nombre de la barbería como lo verá el cliente en su resumen: mayúsculas, sin tildes ni símbolos. */
export function descriptorDe(nombre: string): string {
  return nombre
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
    .slice(0, LARGO_DESCRIPTOR).trim();
}

export interface DatosOrden {
  idPedido: number;
  /** Total del pedido en CLP, entero como texto (Orders API rechaza decimales en CLP). */
  monto: string;
  barberia: string;
  email?: string;
  comprador: { nombre: string; apellido: string | null; registradoEn: string | null };
  items: { idProducto: number; nombre: string; cantidad: number; precioUnitario: number }[];
  pago: { metodoId: string; tipo: string; token: string };
}

export function armarOrden(d: DatosOrden): Record<string, unknown> {
  const descriptor = descriptorDe(d.barberia);
  return {
    type: "online",
    processing_mode: "automatic",
    external_reference: String(d.idPedido),
    description: `Pedido #${d.idPedido} - ${d.barberia}`,
    total_amount: d.monto,
    payer: {
      ...(d.email ? { email: d.email } : {}),
      first_name: d.comprador.nombre,
      ...(d.comprador.apellido ? { last_name: d.comprador.apellido } : {}),
    },
    transactions: {
      payments: [{
        amount: d.monto,
        // El descriptor va dentro de payment_method: en transactions.payments[] la API lo rechaza (400 unsupported_properties)
        payment_method: {
          id: d.pago.metodoId, type: d.pago.tipo, token: d.pago.token, installments: 1,
          ...(descriptor ? { statement_descriptor: descriptor } : {}),
        },
      }],
    },
    items: d.items.map((i) => ({
      external_code: String(i.idProducto),
      title: i.nombre,
      category_id: CATEGORIA_ITEMS,
      quantity: i.cantidad,
      unit_price: String(Math.round(i.precioUnitario)),
    })),
    // Las claves llevan el punto tal cual en la API
    additional_info: {
      "payer.authentication_type": "WEB",
      ...(d.comprador.registradoEn ? { "payer.registration_date": d.comprador.registradoEn } : {}),
    },
  };
}
