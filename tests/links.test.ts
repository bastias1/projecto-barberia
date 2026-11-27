import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("../utils/supabase/service-role", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("../lib/barberia", () => ({ getBarberiaById: vi.fn() }));

import { createServiceRoleClient } from "../utils/supabase/service-role";
import { getBarberiaById } from "../lib/barberia";
import { linkAccion } from "../lib/link-actions";
import { purposeResena, reviewUrl, signLink, verifyLink } from "../lib/signed-links";

// Links firmados de los correos (lib/signed-links.ts) y su GET/POST (lib/link-actions.ts). Sin Supabase.
process.env.BOOKING_SECRET = "secreto-de-prueba";

describe("signLink / verifyLink", () => {
  it("un token válido verifica para su propósito e id", () => {
    expect(verifyLink("confirmar-reserva", 12, signLink("confirmar-reserva", 12))).toBe(true);
    expect(verifyLink("confirmar-reserva", "12", signLink("confirmar-reserva", 12))).toBe(true);
  });

  it("no sirve para otro propósito ni para otro id", () => {
    const token = signLink("confirmar-reserva", 12);
    expect(verifyLink("cancelar-reserva", 12, token)).toBe(false);
    expect(verifyLink("confirmar-reserva", 13, token)).toBe(false);
  });

  it.each([undefined, null, "", "abc", "zz".repeat(32), "a".repeat(63), "a".repeat(65)])("token malformado o ausente: %s", (token) => {
    expect(verifyLink("confirmar-reserva", 12, token)).toBe(false);
  });
});

describe("purposeResena", () => {
  it("separa los links de reserva y de pedido, y reviewUrl firma con el mismo", () => {
    expect(purposeResena("reserva")).toBe("resena-reserva");
    expect(purposeResena("pedido")).toBe("resena-pedido");
    const token = new URL(reviewUrl("pedido", 5)).searchParams.get("token");
    expect(verifyLink(purposeResena("pedido"), 5, token)).toBe(true);
    expect(verifyLink(purposeResena("reserva"), 5, token)).toBe(false);
  });
});

describe("linkAccion", () => {
  const ejecutar = vi.fn();
  const handlers = linkAccion({ purpose: "confirmar-reserva", accion: "confirmar", ejecutar });
  const url = (id: string | number, token: string) => `http://localhost/api/confirm-booking?id=${id}&token=${token}`;
  const valido = () => url(12, signLink("confirmar-reserva", 12));
  const invalido = () => url(12, signLink("cancelar-reserva", 12)); // firmado para otra acción

  function reserva(data: { id_barberia: string } | null) {
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data }) }) }) }),
    } as unknown as SupabaseClient);
  }

  beforeEach(() => {
    ejecutar.mockReset().mockResolvedValue(true);
    vi.mocked(getBarberiaById).mockReset().mockResolvedValue({ slug: "mi-barberia" } as never);
    reserva({ id_barberia: "b1" });
  });

  const pagina = (extra = "") => `http://localhost/mi-barberia/cita?id=12&token=${signLink("confirmar-reserva", 12)}&accion=confirmar${extra}`;

  it("GET con link válido lleva a la página de la cita y no ejecuta nada (los filtros de correo abren los links)", async () => {
    const res = await handlers.GET(new Request(valido()));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(pagina());
    expect(ejecutar).not.toHaveBeenCalled();
  });

  it("GET y POST con link inválido redirigen a /error sin ejecutar", async () => {
    for (const handler of [handlers.GET, handlers.POST]) {
      const res = await handler(new Request(invalido(), { method: "POST" }));
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("http://localhost/error?message=Invalid+token");
    }
    expect(ejecutar).not.toHaveBeenCalled();
  });

  it("POST válido ejecuta con el id numérico y vuelve a la página de la cita", async () => {
    const res = await handlers.POST(new Request(valido(), { method: "POST" }));
    expect(ejecutar).toHaveBeenCalledWith(expect.anything(), 12);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(pagina());
  });

  it("si la acción falla, vuelve a la página de la cita con error=1", async () => {
    ejecutar.mockResolvedValue(false);
    const res = await handlers.POST(new Request(valido(), { method: "POST" }));
    expect(res.headers.get("location")).toBe(pagina("&error=1"));
  });

  it("si la reserva ya no existe, va al inicio", async () => {
    reserva(null);
    const res = await handlers.POST(new Request(valido(), { method: "POST" }));
    expect(res.headers.get("location")).toBe("http://localhost/");
  });
});
