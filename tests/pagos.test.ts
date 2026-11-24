import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("../lib/notifications", () => ({
  notificarStockBajo: vi.fn().mockResolvedValue(undefined),
  notificarPedidoPagado: vi.fn().mockResolvedValue(undefined),
  notificarSuscripcion: vi.fn().mockResolvedValue(undefined),
}));

import { notificarPedidoPagado, notificarStockBajo } from "../lib/notifications";
import {
  estadoPagoDesdeOrder, estadoPagoDesdePayment, registrarPagoCobro, registrarPagoOrder, registrarPagoPayment,
} from "../lib/pagos";

// Registro de pagos de Mercado Pago (lib/pagos.ts). Sin Supabase ni Mercado Pago: un cliente falso
// devuelve el pedido y captura el upsert a `pago`.
const PEDIDO = { id_pedido: 7, id_barberia: "b1", monto_total: 25000 };

/** `previo`: estado del mismo pago ya guardado (null = no existe: el insert gana). */
function cliente({ pedido = PEDIDO as typeof PEDIDO | null, upsertError = null as { message: string } | null, previo = null as string | null } = {}) {
  const upserts: { fila: Record<string, unknown>; opciones: unknown }[] = [];
  const updates: Record<string, unknown>[] = [];
  const db = {
    from: (tabla: string) => tabla === "pedido"
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: pedido }) }) }) }
      : {
        // insert que ignora duplicados: devuelve fila solo si no existía
        upsert: (fila: Record<string, unknown>, opciones: unknown) => {
          upserts.push({ fila, opciones });
          return { select: async () => ({ data: previo === null ? [{}] : [], error: upsertError }) };
        },
        // update condicional: solo si el estado guardado es otro
        update: (cambios: Record<string, unknown>) => ({
          eq: () => ({ eq: () => ({ neq: (_: string, estado: string) => ({ select: async () => {
            const cambia = previo !== null && previo !== estado;
            if (cambia) updates.push(cambios);
            return { data: cambia ? [{}] : [], error: null };
          } }) }) }),
        }),
      },
  } as unknown as SupabaseClient;
  return { db, upserts, updates };
}

const order = (extra: Record<string, unknown> = {}) => ({
  id: "ORD1", external_reference: "7", status: "processed", status_detail: "accredited",
  total_amount: "25000", total_paid_amount: "25000",
  transactions: { payments: [{ id: "PAY1", status_detail: "accredited", payment_method: { id: "visa", installments: 1 } }] },
  ...extra,
}) as never;

const payment = (extra: Record<string, unknown> = {}) => ({
  id: 555, external_reference: "7", status: "approved", status_detail: "accredited",
  transaction_amount: 25000, payment_method_id: "master", installments: 1, ...extra,
}) as never;

const SUS = { id_suscripcion: 3, id_barberia: "b1", precio_pactado: 49990 };
const COBRO = { id: 9, preapproval_id: "PRE1", transaction_amount: 49990, payment: { id: 1, status: "approved", status_detail: "accredited" } };

beforeEach(() => vi.clearAllMocks());

describe("mapeo de estados", () => {
  it.each([
    ["processed", "aprobado"], ["refunded", "reembolsado"], ["charged_back", "reembolsado"], ["failed", "rechazado"],
    ["canceled", "rechazado"], ["expired", "rechazado"], ["created", "pendiente"], ["processing", "pendiente"], [undefined, "pendiente"],
  ])("order %s → %s", (status, esperado) => expect(estadoPagoDesdeOrder(status)).toBe(esperado));

  it.each([
    ["approved", "aprobado"], ["rejected", "rechazado"], ["cancelled", "rechazado"], ["refunded", "reembolsado"],
    ["charged_back", "reembolsado"], ["in_process", "pendiente"], [undefined, "pendiente"],
  ])("payment %s → %s", (status, esperado) => expect(estadoPagoDesdePayment(status)).toBe(esperado));
});

describe("registrarPagoOrder", () => {
  it("guarda el pago con su clave de idempotencia y avisa del stock", async () => {
    const { db, upserts } = cliente();
    expect(await registrarPagoOrder(db, order(), null)).toBe("aprobado");
    expect(upserts).toHaveLength(1);
    expect(upserts[0].opciones).toEqual({ onConflict: "proveedor,id_transaccion_externa", ignoreDuplicates: true });
    expect(upserts[0].fila).toMatchObject({
      id_barberia: "b1", concepto: "pedido", id_pedido: 7, monto: 25000, proveedor: "mercadopago", id_transaccion_externa: "ORD1", estado: "aprobado",
      detalle: { status: "processed", payment_id: "PAY1", payment_method: "visa", installments: 1 },
    });
    expect(notificarStockBajo).toHaveBeenCalledWith("b1");
    expect(notificarPedidoPagado).toHaveBeenCalledWith(7);
  });

  it("el comprobante sale solo para quien escribe el cambio de estado (síncrono + webhook a la vez)", async () => {
    const igual = cliente({ previo: "aprobado" });
    expect(await registrarPagoOrder(igual.db, order(), null)).toBe("aprobado");
    expect(igual.updates).toHaveLength(0);
    expect(notificarPedidoPagado).not.toHaveBeenCalled();

    const pendiente = cliente({ previo: "pendiente" });
    expect(await registrarPagoOrder(pendiente.db, order(), null)).toBe("aprobado");
    expect(pendiente.updates[0]).toMatchObject({ estado: "aprobado", monto: 25000 });
    expect(notificarPedidoPagado).toHaveBeenCalledTimes(1);
  });

  it("monto: lo pagado; sin ese campo, o en cero (order aún sin pagar), el total de la order", async () => {
    const a = cliente(); await registrarPagoOrder(a.db, order({ total_paid_amount: undefined }), null);
    const b = cliente(); await registrarPagoOrder(b.db, order({ total_paid_amount: "0.00" }), null);
    expect(a.upserts[0].fila.monto).toBe(25000);
    expect(b.upserts[0].fila.monto).toBe(25000);
  });

  it.each([["otro total", { total_amount: "15990" }], ["sin total", { total_amount: undefined }]])(
    "%s distinto del pedido: no se registra (el trigger daría el pedido por pagado)", async (_, extra) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { db, upserts } = cliente();
      expect(await registrarPagoOrder(db, order(extra), null)).toBeNull();
      expect(upserts).toHaveLength(0);
      expect(notificarStockBajo).not.toHaveBeenCalled();
      error.mockRestore();
    });

  it("solo se registra si el pedido es de la barbería de cuyo token se leyó la order", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const otra = cliente();
    expect(await registrarPagoOrder(otra.db, order(), "b2")).toBeNull();
    expect(otra.upserts).toHaveLength(0);
    const misma = cliente();
    expect(await registrarPagoOrder(misma.db, order(), "b1")).toBe("aprobado");
    expect(misma.upserts).toHaveLength(1);
    error.mockRestore();
  });

  it.each(["failed", "processing"])("order %s se registra pero no avisa del stock", async (status) => {
    const { db, upserts } = cliente();
    await registrarPagoOrder(db, order({ status }), null);
    expect(upserts).toHaveLength(1);
    expect(notificarStockBajo).not.toHaveBeenCalled();
  });

  it("sin referencia al pedido: no hace nada", async () => {
    const { db, upserts } = cliente();
    expect(await registrarPagoOrder(db, order({ external_reference: undefined }), null)).toBeNull();
    expect(upserts).toHaveLength(0);
  });

  it("pedido inexistente: null y sin pago", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, upserts } = cliente({ pedido: null });
    expect(await registrarPagoOrder(db, order(), null)).toBeNull();
    expect(upserts).toHaveLength(0);
    error.mockRestore();
  });

  it("si falla el guardado: null, queda en el log y no avisa del stock", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = cliente({ upsertError: { message: "boom" } });
    expect(await registrarPagoOrder(db, order(), null)).toBeNull();
    expect(error).toHaveBeenCalled();
    expect(notificarStockBajo).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("registrarPagoPayment (Checkout Pro antiguo)", () => {
  it("usa el id del pago como texto y su monto", async () => {
    const { db, upserts } = cliente();
    expect(await registrarPagoPayment(db, payment())).toBe("aprobado");
    expect(upserts[0].fila).toMatchObject({
      concepto: "pedido", id_pedido: 7, monto: 25000, id_transaccion_externa: "555", estado: "aprobado",
      detalle: { status: "approved", payment_method: "master", installments: 1 },
    });
    expect(notificarStockBajo).toHaveBeenCalledWith("b1");
  });

  it("sin monto en el pago usa el del pedido; rechazado no avisa", async () => {
    const { db, upserts } = cliente();
    expect(await registrarPagoPayment(db, payment({ transaction_amount: undefined, status: "rejected" }))).toBe("rechazado");
    expect(upserts[0].fila.monto).toBe(25000);
    expect(notificarStockBajo).not.toHaveBeenCalled();
  });

  it("sin referencia al pedido: no hace nada", async () => {
    const { db, upserts } = cliente();
    expect(await registrarPagoPayment(db, payment({ external_reference: undefined }))).toBeNull();
    expect(upserts).toHaveLength(0);
  });
});

describe("registrarPagoCobro (suscripción)", () => {
  it("guarda el cobro como pago de suscripción, devuelve su estado y no toca el stock", async () => {
    const { db, upserts } = cliente();
    expect(await registrarPagoCobro(db, COBRO, SUS)).toBe("aprobado");
    expect(upserts[0].fila).toMatchObject({
      id_barberia: "b1", concepto: "suscripcion", id_suscripcion: 3, monto: 49990, id_transaccion_externa: "cobro-9", estado: "aprobado",
      detalle: { preapproval_id: "PRE1", payment_id: 1, status: "approved" },
    });
    expect(upserts[0].fila.id_pedido).toBeUndefined();
    expect(notificarStockBajo).not.toHaveBeenCalled();
  });

  it("cobro rechazado o sin monto: estado y monto de respaldo", async () => {
    const { db, upserts } = cliente();
    expect(await registrarPagoCobro(db, { ...COBRO, transaction_amount: undefined, payment: { status: "rejected" } }, SUS)).toBe("rechazado");
    expect(upserts[0].fila.monto).toBe(49990);
  });
});
