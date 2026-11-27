import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("../lib/notifications", () => ({ notificarCambioReserva: vi.fn(async () => {}) }));
vi.mock("../lib/suscripcion", () => ({ ultimaSuscripcion: vi.fn(), eliminarSuscripcion: vi.fn() }));

import { notificarCambioReserva } from "../lib/notifications";
import { eliminarSuscripcion, ultimaSuscripcion } from "../lib/suscripcion";
import { eliminarBarberiaDe } from "../lib/eliminar-barberia";

const DUENO = "u-dueno";
const entrada = { idBarberia: "b-1", idUsuario: DUENO };
let rpcs: string[];

/** Cliente de service role de mentira: responde según la tabla y anota las RPC llamadas. */
function cliente({ propietario = DUENO, pedidosPendientes = 0 } = {}) {
  const filas: Record<string, unknown> = {
    barberia: { data: { id_propietario: propietario, eliminada_at: null }, error: null },
    pedido: { count: pedidosPendientes, error: null },
  };
  return {
    from: (tabla: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "not"]) q[m] = () => q;
      q.maybeSingle = async () => filas[tabla];
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve(filas[tabla]).then(ok);
      return q;
    },
    rpc: async (nombre: string) => {
      rpcs.push(nombre);
      return { data: nombre === "eliminar_barberia" ? [7, 8] : null, error: null };
    },
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  rpcs = [];
  vi.clearAllMocks();
  vi.mocked(ultimaSuscripcion).mockResolvedValue({ estado: "activa", id_suscripcion_externa: "PRE1" } as never);
  vi.mocked(eliminarSuscripcion).mockResolvedValue({ ok: true, antes: {}, despues: {} });
});

describe("eliminarBarberiaDe", () => {
  it("quien no es propietario no elimina ni toca el cobro", async () => {
    const r = await eliminarBarberiaDe(cliente({ propietario: "otro" }), entrada);
    expect(r.success).toBe(false);
    expect(eliminarSuscripcion).not.toHaveBeenCalled();
    expect(rpcs).toEqual([]);
  });

  it("con pedidos pagados sin entregar no cancela el cobro ni elimina", async () => {
    const r = await eliminarBarberiaDe(cliente({ pedidosPendientes: 1 }), entrada);
    expect(r).toMatchObject({ success: false, error: expect.stringContaining("pedidos pagados") });
    expect(eliminarSuscripcion).not.toHaveBeenCalled();
    expect(rpcs).toEqual([]);
  });

  it("si Mercado Pago no cancela el cobro, no se elimina nada", async () => {
    vi.mocked(eliminarSuscripcion).mockResolvedValue({ ok: false, error: "Mercado Pago no pudo cancelar el cobro.", status: 502 });
    const r = await eliminarBarberiaDe(cliente(), entrada);
    expect(r).toEqual({ success: false, error: "Mercado Pago no pudo cancelar el cobro." });
    expect(rpcs).toEqual([]);
  });

  it("cancela el cobro, desvincula Mercado Pago, elimina y avisa las citas canceladas", async () => {
    const r = await eliminarBarberiaDe(cliente(), entrada);
    expect(r).toEqual({ success: true });
    expect(eliminarSuscripcion).toHaveBeenCalledOnce();
    expect(rpcs).toEqual(["mp_borrar", "eliminar_barberia"]);
    expect(vi.mocked(notificarCambioReserva).mock.calls).toEqual([[7, "cancelada"], [8, "cancelada"]]);
  });

  it("sin suscripción vigente ni cobro no intenta cancelar nada", async () => {
    vi.mocked(ultimaSuscripcion).mockResolvedValue({ estado: "vencida", id_suscripcion_externa: null } as never);
    expect(await eliminarBarberiaDe(cliente(), entrada)).toEqual({ success: true });
    expect(eliminarSuscripcion).not.toHaveBeenCalled();
  });
});
