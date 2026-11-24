import { describe, expect, it } from "vitest";
import { crearState, leerState, urlAutorizacion } from "../lib/mercadopago-oauth";
import { signLink } from "../lib/signed-links";

// OAuth de Mercado Pago (lib/mercadopago-oauth.ts): el state liga la vuelta al usuario y la barbería. Sin red.
process.env.BOOKING_SECRET = "secreto-de-prueba";
process.env.MERCADOPAGO_CLIENT_ID = "123";
process.env.MERCADOPAGO_CLIENT_SECRET = "secreto";
process.env.NEXT_PUBLIC_SITE_URL = "https://www.sunwalk.app";

const USER = "6f1c2b0e-0000-4000-8000-000000000001";

describe("state de Mercado Pago", () => {
  it("ida y vuelta entrega el usuario y la barbería", () => {
    expect(leerState(crearState(USER, "benjvmin"))).toEqual({ userId: USER, slug: "benjvmin" });
  });

  it("vencido (más de 10 minutos) no vale", () => {
    const ahora = Date.now();
    expect(leerState(crearState(USER, "benjvmin", ahora - 11 * 60_000))).toBeNull();
  });

  it("cambiar la barbería o el usuario invalida la firma", () => {
    const [u, , exp, firma] = crearState(USER, "benjvmin").split(".");
    expect(leerState(`${u}.otra-barberia.${exp}.${firma}`)).toBeNull();
    expect(leerState(`${USER.replace("1", "2")}.benjvmin.${exp}.${firma}`)).toBeNull();
  });

  it("una firma de otro propósito (Google) no sirve", () => {
    const expira = Date.now() + 60_000;
    const firmaGoogle = signLink("google-oauth", `${USER}:benjvmin:${expira}`);
    expect(leerState(`${USER}.benjvmin.${expira}.${firmaGoogle}`)).toBeNull();
  });

  it.each([null, undefined, "", "a.b.c", "a.b.c.d.e"])("state malformado (%s)", (state) => {
    expect(leerState(state)).toBeNull();
  });
});

describe("urlAutorizacion", () => {
  it("apunta a Mercado Pago con el redirect registrado y el state", () => {
    const url = new URL(urlAutorizacion("abc"));
    expect(url.origin + url.pathname).toBe("https://auth.mercadopago.com/authorization");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("https://www.sunwalk.app/api/mercadopago/callback");
    expect(url.searchParams.get("state")).toBe("abc");
  });
});
