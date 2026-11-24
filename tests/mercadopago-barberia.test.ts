import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/mercadopago-oauth", () => ({ renovarTokens: vi.fn(), guardarTokens: vi.fn() }));

import { renovarTokens, guardarTokens } from "../lib/mercadopago-oauth";
import { SinMercadoPago, tokenBarberia, tokenDeVendedor } from "../lib/mercadopago-barberia";

// Token de la cuenta de Mercado Pago de cada barbería (lib/mercadopago-barberia.ts). Sin Supabase: admin falso.
const DIA = 24 * 3600_000;
const en = (ms: number) => new Date(Date.now() + ms).toISOString();
const secreto = (access: string) => JSON.stringify({ access_token: access, refresh_token: `refresh-${access}` });

type Fila = { estado: string; expira_at: string } | null;

/** `filas` y `secretos` se entregan en orden, uno por lectura (la última se repite). */
function adminFalso(filas: Fila[], secretos: string[]) {
  const updates: Record<string, unknown>[] = [];
  let lecturas = 0;
  let rpcs = 0;
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: filas[Math.min(lecturas++, filas.length - 1)] }) }) }),
      update: (v: Record<string, unknown>) => ({ eq: async () => { updates.push(v); return { error: null }; } }),
    }),
    rpc: async () => ({ data: secretos[Math.min(rpcs++, secretos.length - 1)], error: null }),
  };
  return { admin: admin as never, updates };
}

beforeEach(() => {
  vi.mocked(renovarTokens).mockReset();
  vi.mocked(guardarTokens).mockReset().mockResolvedValue("secreto-id");
});

describe("tokenBarberia", () => {
  it("con el token lejos de vencer lo entrega sin renovar", async () => {
    const { admin } = adminFalso([{ estado: "conectada", expira_at: en(100 * DIA) }], [secreto("A")]);
    await expect(tokenBarberia(admin, "b1")).resolves.toBe("A");
    expect(renovarTokens).not.toHaveBeenCalled();
  });

  it.each([null, { estado: "desconectada", expira_at: en(100 * DIA) }])("sin conexión activa (%j) lanza SinMercadoPago", async (fila) => {
    const { admin } = adminFalso([fila], [secreto("A")]);
    await expect(tokenBarberia(admin, "b1")).rejects.toBeInstanceOf(SinMercadoPago);
  });

  it("cerca del vencimiento renueva, guarda los tokens nuevos y entrega el nuevo", async () => {
    vi.mocked(renovarTokens).mockResolvedValue({ accessToken: "B", refreshToken: "rB", expiraAt: new Date(Date.now() + 180 * DIA), userId: 1 });
    const { admin, updates } = adminFalso([{ estado: "conectada", expira_at: en(5 * DIA) }], [secreto("A")]);
    await expect(tokenBarberia(admin, "b1")).resolves.toBe("B");
    expect(renovarTokens).toHaveBeenCalledWith("refresh-A");
    expect(guardarTokens).toHaveBeenCalledWith(admin, "b1", expect.objectContaining({ accessToken: "B", refreshToken: "rB" }));
    expect(updates).toHaveLength(1);
  });

  it("si Mercado Pago rechaza la renovación (acceso revocado) marca desconectada y lanza", async () => {
    vi.mocked(renovarTokens).mockRejectedValue(new Error("Mercado Pago rechazó la solicitud de token: invalid_grant"));
    const { admin, updates } = adminFalso([{ estado: "conectada", expira_at: en(5 * DIA) }], [secreto("A")]);
    await expect(tokenBarberia(admin, "b1")).rejects.toBeInstanceOf(SinMercadoPago);
    expect(updates).toEqual([expect.objectContaining({ estado: "desconectada" })]);
  });

  it("una falla pasajera con el token aún vigente sigue con él, sin desconectar", async () => {
    vi.mocked(renovarTokens).mockRejectedValue(new Error("fetch failed"));
    const { admin, updates } = adminFalso([{ estado: "conectada", expira_at: en(5 * DIA) }], [secreto("A")]);
    await expect(tokenBarberia(admin, "b1")).resolves.toBe("A");
    expect(updates).toHaveLength(0);
  });

  it("una falla pasajera con el token ya vencido desconecta: no hay con qué cobrar", async () => {
    vi.mocked(renovarTokens).mockRejectedValue(new Error("fetch failed"));
    const { admin } = adminFalso([{ estado: "conectada", expira_at: en(-DIA) }], [secreto("A")]);
    await expect(tokenBarberia(admin, "b1")).rejects.toBeInstanceOf(SinMercadoPago);
  });

  it("si otro pago renovó a la vez, usa el token ya renovado en vez de desconectar", async () => {
    vi.mocked(renovarTokens).mockRejectedValue(new Error("Mercado Pago rechazó la solicitud de token: invalid_grant"));
    const { admin, updates } = adminFalso(
      [{ estado: "conectada", expira_at: en(5 * DIA) }, { estado: "conectada", expira_at: en(180 * DIA) }],
      [secreto("A"), secreto("B")],
    );
    await expect(tokenBarberia(admin, "b1")).resolves.toBe("B");
    expect(updates).toHaveLength(0);
  });
});

describe("tokenDeVendedor", () => {
  it.each([undefined, null, NaN, "abc", 1.5])("un user_id inválido (%s) usa la cuenta de Sunwalk", async (id) => {
    const { admin } = adminFalso([null], []);
    await expect(tokenDeVendedor(admin, id)).resolves.toBeUndefined();
  });

  it("un vendedor que no es de ninguna barbería usa la cuenta de Sunwalk", async () => {
    const { admin } = adminFalso([null], []);
    await expect(tokenDeVendedor(admin, 123)).resolves.toBeUndefined();
  });

  it("un vendedor de una barbería usa el token de esa barbería y devuelve cuál es", async () => {
    const { admin } = adminFalso(
      [{ id_barberia: "b1" } as never, { estado: "conectada", expira_at: en(100 * DIA) }],
      [secreto("A")],
    );
    await expect(tokenDeVendedor(admin, 123)).resolves.toEqual({ accessToken: "A", idBarberia: "b1" });
  });
});
