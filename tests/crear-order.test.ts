import { beforeEach, describe, expect, it, vi } from "vitest";

// crearOrder (lib/pagos.ts) con el SDK de Mercado Pago falso: en un 402 la order existe pero el error no la trae.
const sdk = vi.hoisted(() => ({ create: vi.fn(), search: vi.fn() }));
vi.mock("mercadopago", async (original) => {
  const real = await original<typeof import("mercadopago")>();
  return { ...real, Order: vi.fn(function () { return sdk; }) };
});
vi.mock("../lib/notifications", () => ({}));

import { MPBadRequestError, MPPaymentError } from "mercadopago";
import { crearOrder, ESPERAS_BUSQUEDA_MS } from "../lib/pagos";

const BODY = { external_reference: "1014" } as never;
const ORDER = { id: "ORD1", status: "failed" };

beforeEach(() => {
  vi.clearAllMocks();
  ESPERAS_BUSQUEDA_MS.splice(0, ESPERAS_BUSQUEDA_MS.length, 0, 0, 0, 0);
});

describe("crearOrder", () => {
  it("devuelve la order creada", async () => {
    sdk.create.mockResolvedValue(ORDER);
    expect(await crearOrder("T", BODY, "k")).toEqual({ order: ORDER, error: null });
    expect(sdk.search).not.toHaveBeenCalled();
  });

  it("402: reintenta la búsqueda hasta que aparece la order recién creada", async () => {
    sdk.create.mockRejectedValue(new MPPaymentError({ status: 402 }));
    sdk.search.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [ORDER] });
    const r = await crearOrder("T", BODY, "k");
    expect(r.order).toEqual(ORDER);
    expect(sdk.search).toHaveBeenCalledTimes(3);
    expect(sdk.search.mock.calls[0][0].options.external_reference).toBe("1014");
  });

  it("402 sin encontrarla: order null tras todos los intentos", async () => {
    sdk.create.mockRejectedValue(new MPPaymentError({ status: 402 }));
    sdk.search.mockResolvedValue({ data: [] });
    expect((await crearOrder("T", BODY, "k")).order).toBeNull();
    expect(sdk.search).toHaveBeenCalledTimes(4);
  });

  it("otro error (400): no busca", async () => {
    sdk.create.mockRejectedValue(new MPBadRequestError({ status: 400 }));
    expect((await crearOrder("T", BODY, "k")).order).toBeNull();
    expect(sdk.search).not.toHaveBeenCalled();
  });
});
